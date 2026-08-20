import type { Request } from 'express';

export type Port5555RequestShape = Pick<Request, 'headers' | 'path' | 'baseUrl' | 'originalUrl'>;

export const isPort5555Request = (req: Port5555RequestShape): boolean => {
  const baseUrl = req.baseUrl || '';
  const originalUrl = req.originalUrl || '';

  return req.headers['x-port-5555'] === 'true'
    || req.path.startsWith('/api/port5555')
    || baseUrl.includes('/port5555')
    || originalUrl.includes('/api/port5555')
    || originalUrl.includes(':5555');
};
