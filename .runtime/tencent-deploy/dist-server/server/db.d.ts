import type { Prisma, PrismaClient as PrismaClientType, User } from '../prisma/generated/client/index.js';
export type { Prisma, User };
declare const prisma: PrismaClientType<{
    log: ("error" | "warn" | "query")[];
    errorFormat: "minimal";
    datasources: {
        db: {
            url: string;
        };
    };
}, never, import("@prisma/client/runtime/library.js").DefaultArgs>;
declare let isDbConnected: boolean;
export { isDbConnected };
export default prisma;
//# sourceMappingURL=db.d.ts.map