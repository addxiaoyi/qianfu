import { logger } from '../../utils/logger';
/**
 * Global error handling middleware
 * @param err Error object
 * @param req Request object
 * @param res Response object
 * @param next Next middleware function
 */
export const errorHandler = (err, req, res, _next) => {
    logger.error(`[IntelligentProbeService Error] ${req.method} ${req.originalUrl}:`, { error: err }); // Log error including request method and URL
    const statusCode = err.statusCode || 500;
    // Mask internal error messages in production
    const message = process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'An unexpected error occurred'
        : (err.message || 'Internal server error');
    res.status(statusCode).json({
        success: false,
        message: message,
        // More error information can be returned in development environment
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
//# sourceMappingURL=errorHandler.js.map