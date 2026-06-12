import { Request } from 'express';
export interface PaginationOptions {
    page: number;
    limit: number;
    skip: number;
}
export declare const getPaginationOptions: (req: Request, defaultLimit?: number) => PaginationOptions;
//# sourceMappingURL=pagination.d.ts.map