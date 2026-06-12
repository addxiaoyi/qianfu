import type { Application } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import prisma from '../db';
import localPrisma from '../localDb';
import { redisService } from '../services/redisService';
import { metricsService } from '../services/metricsService';
import { logger } from '../utils/logger';
import { isSafeHostname, mcStatusDirectTestSchema, validateHost } from '../utils/validation';
import { API_PREFIX, API_VERSION_PREFIX } from '../constants/api';
import crypto from 'node:crypto';
import { handleGitHubAuthCallback, startGitHubAuth } from '../controllers/githubAuthController';

function createSignedCsrfToken(token: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

function issueCsrfToken(res: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }) {
  const secret = crypto.randomBytes(32).toString('hex');
  const token = crypto.randomBytes(32).toString('hex');
  const signedToken = createSignedCsrfToken(token, secret);
  const isSecure = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: (isDevelopment ? 'lax' : 'strict') as 'lax' | 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production'
      ? { domain: process.env.COOKIE_DOMAIN || undefined }
      : {}),
  };

  res.cookie('csrf_secret', secret, cookieOptions);
  res.cookie('csrf_token', signedToken, {
    ...cookieOptions,
    httpOnly: false,
  });

  return {
    status: 'ok',
    csrfToken: signedToken,
    token: signedToken,
    headerName: 'x-csrf-token',
    expiresIn: 3600,
    expiresInSeconds: 7200,
    timestamp: new Date().toISOString(),
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: string;
  error?: string;
}

interface DependencyHealth {
  database: ServiceHealth;
  local_database: ServiceHealth;
  cache: ServiceHealth;
  metrics: ServiceHealth;
  smtp?: ServiceHealth;
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  ready: boolean;
  timestamp: string;
  version: string;
  uptime: {
    seconds: number;
    human: string;
  };
  services: DependencyHealth;
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    heapUsagePercent: number;
    external: string;
  };
  gc?: {
    gcCount: number;
    totalGCTime: string;
  };
  env: string;
  checks?: {
    dbQueryTime: string;
    cacheLatency: string;
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function isCacheReadyStatus(cacheStatus: string): boolean {
  return cacheStatus === 'connected' || cacheStatus === 'memory';
}

export function registerHealthRoutes(app: Application) {
  const buildOAuthStatusPayload = () => {
    const apiPublicUrl = process.env.API_PUBLIC_URL || '';
    const frontendUrl = process.env.FRONTEND_URL || '';

    const githubClientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    const qqClientId = process.env.QQ_CLIENT_ID?.trim() || '';
    const qqClientSecret = process.env.QQ_CLIENT_SECRET?.trim() || '';

    const githubBackEnabled = Boolean(githubClientId && githubClientSecret);
    const qqBackEnabled = Boolean(qqClientId && qqClientSecret);
    const frontendOAuthCallback = frontendUrl ? `${frontendUrl}/oauth/callback/github?provider=github` : null;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      app: {
        nodeEnv: process.env.NODE_ENV || 'development',
        apiPublicUrl,
        frontendUrl,
      },
      providers: {
        github: {
          backendEnabled: githubBackEnabled,
          configuredKeys: {
            clientId: Boolean(githubClientId),
            clientSecret: Boolean(githubClientSecret),
          },
          expectedCallback: apiPublicUrl ? `${apiPublicUrl}/api/v1/auth/github/callback` : null,
          frontendCallback: frontendOAuthCallback,
          loginUrl: apiPublicUrl ? `${apiPublicUrl}/api/v1/auth/github/start` : null,
          flow: 'manual-local-jwt',
        },
        qq: {
          backendEnabled: qqBackEnabled,
          configuredKeys: {
            clientId: Boolean(qqClientId),
            clientSecret: Boolean(qqClientSecret),
          },
          expectedCallback: apiPublicUrl ? `${apiPublicUrl}/auth/callback/qq` : null,
        },
      },
      hints: {
        frontendFlags: {
          VITE_GITHUB_LOGIN_ENABLED: process.env.VITE_GITHUB_LOGIN_ENABLED || 'not_set_on_server',
          VITE_QQ_LOGIN_ENABLED: process.env.VITE_QQ_LOGIN_ENABLED || 'not_set_on_server',
        },
        note: 'Frontend now uses backend OAuth status instead of static VITE_GITHUB_OAUTH_URL.',
      },
    };
  };

  app.get(`${API_PREFIX}/v1/csrf-token`, async (_req, res) => {
    return res.status(200).json(issueCsrfToken(res));
  });

  // Legacy/non-versioned GitHub OAuth routes kept for callback compatibility.
  app.get('/auth/github/start', startGitHubAuth);
  app.get('/auth/github/callback', handleGitHubAuthCallback);
  app.get('/auth/callback/github', handleGitHubAuthCallback);

  app.get(`${API_PREFIX}/health`, async (_req, res) => {
    const startTime = Date.now();
    
    // Initialize health status
    const health: HealthReport = {
      status: 'healthy',
      ready: true,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: {
        seconds: Math.floor(process.uptime()),
        human: formatUptime(Math.floor(process.uptime())),
      },
      services: {
        database: { status: 'healthy' },
        local_database: { status: 'healthy' },
        cache: { status: 'healthy' },
        metrics: { status: 'healthy' },
      },
      memory: {
        rss: '0MB',
        heapTotal: '0MB',
        heapUsed: '0MB',
        heapUsagePercent: 0,
        external: '0MB',
      },
      env: process.env.NODE_ENV || 'unknown',
    };

    // Check database
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      health.services.database = {
        status: dbLatency < 100 ? 'healthy' : 'degraded',
        latency: `${dbLatency}ms`,
      };
      health.checks = { dbQueryTime: `${dbLatency}ms`, cacheLatency: 'pending' };
    } catch (error: any) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message,
      };
      health.status = 'degraded';
      health.ready = false;
    }

    // Check local database
    if (localPrisma) {
      try {
        const localStart = Date.now();
        await localPrisma.$queryRaw`SELECT 1`;
        health.services.local_database = {
          status: (Date.now() - localStart) < 100 ? 'healthy' : 'degraded',
          latency: `${Date.now() - localStart}ms`,
        };
      } catch (error: any) {
        health.services.local_database = {
          status: 'degraded',
          error: error.message,
        };
      }
    } else {
      health.services.local_database = { status: 'healthy' };
    }

    // Check Redis cache
    try {
      const cacheStart = Date.now();
      await redisService.ping();
      const cacheLatency = Date.now() - cacheStart;
      health.services.cache = {
        status: cacheLatency < 50 ? 'healthy' : 'degraded',
        latency: `${cacheLatency}ms`,
      };
      if (health.checks) {
        health.checks.cacheLatency = `${cacheLatency}ms`;
      }
    } catch (error: any) {
      health.services.cache = {
        status: 'degraded',
        error: error.message,
      };
      health.ready = false;
    }

    // Check metrics service
    health.services.metrics = {
      status: metricsService.isReady ? 'healthy' : 'degraded',
    };

    // Memory info
    const memUsage = process.memoryUsage();
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    health.memory = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapUsagePercent: heapPercent,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    };

    // GC stats (if available)
    if (global.gc) {
      health.gc = {
        gcCount: 0, // V8 doesn't expose this directly
        totalGCTime: 'N/A',
      };
    }

    // Determine overall status
    const unhealthyServices = Object.values(health.services).filter(s => s.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      health.status = 'unhealthy';
      health.ready = false;
    } else {
      const degradedServices = Object.values(health.services).filter(s => s.status === 'degraded');
      if (degradedServices.length > 0) {
        health.status = 'degraded';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    const totalTime = Date.now() - startTime;
    logger.info(`[HealthCheck] Completed in ${totalTime}ms - Status: ${health.status}`);

    res.status(statusCode).json(health);
  });

  app.get(`${API_PREFIX}/ready`, async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const cacheStatus = await redisService.ping();
      const ready = isCacheReadyStatus(cacheStatus) && metricsService.isReady;

      return res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'not_ready',
        ready,
        cache: cacheStatus,
        metrics: metricsService.isReady ? 'ready' : 'initializing',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          cache: isCacheReadyStatus(cacheStatus) ? 'ok' : 'failed',
          metrics: metricsService.isReady ? 'ok' : 'initializing',
        },
      });
    } catch (error: any) {
      return res.status(503).json({
        status: 'not_ready',
        ready: false,
        error: process.env.NODE_ENV === 'development' ? error.message : 'dependency check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @swagger
   * /api/health/detailed:
   *   get:
   *     summary: Get detailed health status with all dependencies
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Detailed health report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy]
   *                 ready:
   *                   type: boolean
   *                 services:
   *                   type: object
   *                   properties:
   *                     database:
   *                       type: object
   *                     cache:
   *                       type: object
   *                     metrics:
   *                       type: object
   *       503:
   *         description: Service unhealthy
   */
  app.get(`${API_PREFIX}/health/detailed`, async (_req, res) => {
    // Redirect to main health endpoint for detailed info
    const health = await fetch(`${process.env.API_PUBLIC_URL || 'http://localhost:3000'}${API_PREFIX}/health`);
    const data = await health.json();
    res.status(health.status).json(data);
  });

  app.get(`${API_VERSION_PREFIX}/csrf-token`, (_req, res) => {
    res.status(200).json(issueCsrfToken(res));
  });

  app.get(`${API_PREFIX}/auth/oauth-status`, (_req, res) => {
    res.status(200).json(buildOAuthStatusPayload());
  });

  app.get(`${API_VERSION_PREFIX}/auth/oauth-status`, (_req, res) => {
    res.status(200).json(buildOAuthStatusPayload());
  });

  app.get(`${API_PREFIX}/test-mcstatus-direct`, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ error: 'Endpoint not available' });
    }

    const validation = mcStatusDirectTestSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error.issues });
    }

    const { host: testHost, type: testType } = validation.data;
    const hostError = validateHost(testHost);
    if (hostError) {
      return res.status(400).json({ error: hostError.message });
    }

    if (!(await isSafeHostname(testHost))) {
      return res.status(400).json({ error: 'Access to internal network addresses is forbidden' });
    }

    const url = `https://api.mcstatus.io/v2/status/${testType}/${encodeURIComponent(testHost)}`;
    logger.info(`[MCStatus Direct Test] Attempting to fetch: ${url}`);

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        logger.error(`[MCStatus Direct Test] Failed to fetch ${url}: Status ${response.status}`);
        return res.status(response.status).json({ error: 'Failed to fetch from mcstatus.io directly' });
      }
      const data = await response.json();
      logger.info(`[MCStatus Direct Test] Successfully fetched ${url}`);
      return res.json(data);
    } catch (error: any) {
      logger.error(`[MCStatus Direct Test] Error fetching ${url}:`, error.message);
      const errorLogPath = path.join(process.cwd(), 'mcstatus_error.log');
      fs.writeFileSync(
        errorLogPath,
        `Timestamp: ${new Date().toISOString()}\nURL: ${url}\nError: ${error.message}\n\n`,
        { flag: 'a' }
      );
      return res.status(500).json({ error: 'Error during direct fetch to mcstatus.io' });
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
}
