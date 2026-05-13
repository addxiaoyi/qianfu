import type { User as PrismaUser } from '../../prisma/generated/client';

declare global {
  namespace Express {
    interface Request {
      user?: PrismaUser & {
        permissions?: string | string[];
      };
      isAdmin?: boolean;
      graylisted?: boolean;
      timedout?: boolean;
      requestId?: string;
      session?: {
        port5555SessionStart?: number;
        [key: string]: any;
      };
      csrfToken?: string;
      ip: string;
    }
  }
}

export interface AuthRequest extends Express.Request {
  user: PrismaUser & {
    permissions?: string | string[];
  };
}
