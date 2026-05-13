import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  maxAge: number;
  staleWhileRevalidate?: number;
}

const defaultCache: Record<string, CacheOptions> = {
  '/api/public/servers': { maxAge: 300000, staleWhileRevalidate: 60000 },
  '/api/servers/public/servers': { maxAge: 300000, staleWhileRevalidate: 60000 },
  '/api/stats/stats': { maxAge: 60000, staleWhileRevalidate: 30000 },
  '/health': { maxAge: 60000 }
};

/**
 * Cache middleware to set Cache-Control headers for specific API endpoints
 */
export function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Find cache options for the current path
  const path = req.path;
  const cacheOptions = defaultCache[path];
  
  if (!cacheOptions) {
    return next();
  }

  const maxAgeSeconds = Math.floor(cacheOptions.maxAge / 1000);
  let cacheControl = `public, max-age=${maxAgeSeconds}`;

  if (cacheOptions.staleWhileRevalidate) {
    const swrSeconds = Math.floor(cacheOptions.staleWhileRevalidate / 1000);
    cacheControl += `, stale-while-revalidate=${swrSeconds}`;
  }

  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', 'Accept-Encoding, Accept-Language, Authorization');

  next();
}
