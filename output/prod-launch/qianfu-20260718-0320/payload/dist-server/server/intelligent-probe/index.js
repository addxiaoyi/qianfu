import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import probeRoutes from './routes/probeRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './db.js'; // Use the shared instance from db.ts
import { logger } from '../utils/logger.js';
import { resolveListenHost, resolveProbePort } from '../config/listenHost.js';
const app = express();
const port = resolveProbePort();
const host = resolveListenHost(process.env.NODE_ENV, process.env.INTELLIGENT_PROBE_BIND_HOST ?? process.env.API_BIND_HOST);
// Remove local export, now handled by db.ts
const probeCorsOrigins = process.env.INTELLIGENT_PROBE_CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const corsMiddleware = cors(probeCorsOrigins && probeCorsOrigins.length > 0
    ? { origin: probeCorsOrigins, credentials: false }
    : process.env.NODE_ENV === 'production'
        ? { origin: false }
        : { origin: true, credentials: false });
app.use(corsMiddleware);
app.use(express.json());
app.use('/api/intelligent-probe', probeRoutes);
app.get('/', (req, res) => {
    res.send('Intelligent Probe Service is running!');
});
// Error handling middleware must be placed after all routes
app.use(errorHandler);
export const startIntelligentProbeService = () => {
    app.listen(port, host, async () => {
        logger.info(`Intelligent Probe Service listening on ${host}:${port}`);
        try {
            await prisma.$connect(); // Connect to the database
            logger.info('Prisma connected to database!');
        }
        catch (error) {
            logger.error('Failed to connect Prisma to database:', { error });
            process.exit(1); // Exit process if connection fails
        }
    });
};
// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    logger.info('Prisma disconnected from database.');
});
// Start service when this file is run as a standalone script
const __filenameResolved = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
if (process.argv[1] === __filenameResolved) {
    // Catch uncaught exceptions and unhandled promise rejections to prevent service crash
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', { error });
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', { promise, reason });
    });
    startIntelligentProbeService();
}
//# sourceMappingURL=index.js.map