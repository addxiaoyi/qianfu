import dotenv from 'dotenv';
dotenv.config();
/** 校验关键环境变量（见 server/config/env.ts）；生产校验失败会退出 */
import './config/env';
import http from 'http';
import app from './app';
import { logger } from './utils/logger';
import { startCleanupScheduler, cleanupExpiredUnverified } from './services/cleanupService';
import { metricsService } from './services/metricsService';
import { startPeriodicSync } from './services/syncService';
import { startIntelligentProbeService } from './intelligent-probe';
import { notificationQueue } from './services/notificationQueue';
import { startDbOptimizerScheduler } from './services/dbOptimizer';
import { initPaymentHandlers } from './services/paymentHandler';
import { backupService } from './services/backupService';
import { warmUpCache } from '../scripts/warmup-cache';
import { PluginLoader } from './services/pluginLoader';
import { ActivityService } from './services/activityService';
import { reconciliationJob } from './core/task/ReconciliationJob';
import prisma from './db';
const preferredPort = Number(process.env.PORT) || 3000;
const portStrict = process.env.PORT_STRICT === '1' || process.env.PORT_STRICT === 'true';
const MAX_PORT_OFFSET = 100;
const server = http.createServer(app);
let shuttingDownFromProcessError = false;
/**
 * Graceful shutdown handler - stops all timers and services
 */
async function gracefulShutdown(signal, exitCode = 0) {
    logger.info(`[GracefulShutdown] Received ${signal}, starting shutdown...`);
    try {
        // Stop HTTP server (stop accepting new connections)
        await new Promise((resolve) => {
            server.close(() => {
                logger.info('[GracefulShutdown] HTTP server closed');
                resolve();
            });
        });
        // Stop scheduled tasks and timers
        ActivityService.stop();
        logger.info('[GracefulShutdown] ActivityService stopped');
        notificationQueue.stopWorker();
        logger.info('[GracefulShutdown] NotificationQueue stopped');
        if (cleanupService?.intervalId) {
            clearInterval(cleanupService.intervalId);
            logger.info('[GracefulShutdown] CleanupService stopped');
        }
        if (reconciliationJob?.stop) {
            reconciliationJob.stop();
            logger.info('[GracefulShutdown] ReconciliationJob stopped');
        }
        if (backupService?.stop) {
            backupService.stop();
            logger.info('[GracefulShutdown] BackupService stopped');
        }
        // Gracefully close database connections
        await prisma.$disconnect();
        logger.info('[GracefulShutdown] Database disconnected');
        // Allow time for in-flight requests to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        logger.info('[GracefulShutdown] Shutdown complete');
        process.exit(exitCode);
    }
    catch (err) {
        logger.error('[GracefulShutdown] Error during shutdown:', err);
        process.exit(1);
    }
}
// Register graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    logger.error('[ProcessGuard] Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});
process.on('uncaughtException', (error) => {
    logger.error('[ProcessGuard] Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    if (shuttingDownFromProcessError) {
        process.exit(1);
        return;
    }
    shuttingDownFromProcessError = true;
    void gracefulShutdown('UNCAUGHT_EXCEPTION', 1).catch(() => {
        process.exit(1);
    });
});
let cleanupService;
function onListening(port) {
    logger.info(`Server running on port ${port}`);
    if (port !== preferredPort) {
        logger.warn(`[端口] 首选 ${preferredPort} 已被占用，已使用 ${port}。若同时跑 Vite，请设置 VITE_BACKEND_URL=http://localhost:${port}`);
    }
    // Initialize and load plugins
    PluginLoader.init().catch(err => {
        logger.error('[PluginLoader] Initialization error:', err);
    });
    initPaymentHandlers();
    startIntelligentProbeService();
    notificationQueue.startWorker();
    // Start activity updates
    ActivityService.start();
    // 缓存预热 (Cache Warm-up)
    warmUpCache().catch(err => {
        logger.error('[WarmUp] Initial warm-up failed:', err);
    });
    // Start background sync for local -> main DB
    startPeriodicSync();
    // Start DB optimizer
    startDbOptimizerScheduler();
    // Start QianFu reconciliation job and callback queue
    if (process.env.QIANFU_ENABLED === 'true') {
        reconciliationJob.start();
        logger.info('[QianFu] Reconciliation job started');
    }
    // These tasks are now handled by Motia if enabled
    if (process.env.MOTIA_ENABLED === 'true') {
        logger.info('-----------------------------------------');
        logger.info('[Motia] Workflow Integration Active');
        logger.info('[Motia] Cron: Cleanup (1m), Backup (10m)');
        logger.info('[Motia] Events: server.created');
        logger.info('-----------------------------------------');
    }
    else {
        cleanupExpiredUnverified().catch(() => { });
        cleanupService = { intervalId: startCleanupScheduler(60000) };
        // Start automated backup service
        backupService.start();
    }
    metricsService.init().catch(err => {
        logger.error('[MetricsService] Failed to initialize:', err);
    });
}
function bindPort(port) {
    const onError = (err) => {
        server.removeListener('error', onError);
        if (err.code === 'EADDRINUSE' &&
            !portStrict &&
            port < preferredPort + MAX_PORT_OFFSET) {
            logger.warn(`端口 ${port} 已被占用，尝试 ${port + 1}…`);
            bindPort(port + 1);
            return;
        }
        logger.error('Server listen failed:', err);
        process.exit(1);
    };
    server.once('error', onError);
    server.listen(port, () => {
        server.removeListener('error', onError);
        onListening(port);
    });
}
bindPort(preferredPort);
//# sourceMappingURL=index.js.map