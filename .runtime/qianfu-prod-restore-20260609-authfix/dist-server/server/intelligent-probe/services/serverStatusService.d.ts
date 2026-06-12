import { Prisma } from '../../../prisma/generated/local-client';
export declare const createServerStatus: (data: Prisma.ServerStatusCreateInput) => Promise<any>;
export declare const getServerStatusById: (id: number) => Promise<any>;
export declare const getServerStatusByServerId: (serverId: number) => Promise<any>;
export declare const updateServerStatus: (id: number, data: Prisma.ServerStatusUpdateInput) => Promise<any>;
export declare const deleteServerStatus: (id: number) => Promise<any>;
//# sourceMappingURL=serverStatusService.d.ts.map