/**
 * Alert Escalation Service - Main Entry Point
 */

import express, { Request, Response } from 'express';
import { EscalationEngine } from './escalationService';
import { routes } from './routes';
import * as winston from 'winston';

// ============================================
// Logger Configuration
// ============================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// ============================================
// Initialize Service
// ============================================

const app = express();
const port = parseInt(process.env.METRICS_PORT || '9094', 10);

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const status = engine.getStatus();
  res.json({
    status: 'healthy',
    running: status.running,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req: Request, res: Response) => {
  const status = engine.getStatus();

  const metrics = `
# HELP escalation_service_running Whether the escalation service is running
# TYPE escalation_service_running gauge
escalation_service_running ${status.running ? 1 : 0}

# HELP escalation_service_alerts_total Total number of alerts being tracked
# TYPE escalation_service_alerts_total gauge
escalation_service_alerts_total ${status.totalAlerts}

# HELP escalation_service_last_check_timestamp Timestamp of last check
# TYPE escalation_service_last_check_timestamp gauge
escalation_service_last_check_timestamp ${new Date(status.lastCheck).getTime() / 1000}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// API routes
app.use('/api', routes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================
// Start Escalation Engine
// ============================================

const engine = new EscalationEngine();

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  engine.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
app.listen(port, async () => {
  logger.info(`Alert Escalation Service listening on port ${port}`);

  try {
    await engine.start();
    logger.info('Escalation engine started successfully');
  } catch (error) {
    logger.error('Failed to start escalation engine:', error);
    process.exit(1);
  }
});

export { app, engine, logger };
