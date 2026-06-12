import { Prisma } from '../../../prisma/generated/local-client';
export declare const createServer: (data: Prisma.ServerCreateInput) => Promise<any>;
export declare const getServerById: (id: number) => Promise<any>;
export declare const getAllServers: () => Promise<any>;
export declare const updateServer: (id: number, data: Prisma.ServerUpdateInput) => Promise<any>;
export declare const deleteServer: (id: number) => Promise<any>;
//# sourceMappingURL=serverService.d.ts.map