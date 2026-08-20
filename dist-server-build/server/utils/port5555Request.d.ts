import type { Request } from 'express';
export type Port5555RequestShape = Pick<Request, 'headers' | 'path' | 'baseUrl' | 'originalUrl'>;
export declare const isPort5555Request: (req: Port5555RequestShape) => boolean;
//# sourceMappingURL=port5555Request.d.ts.map