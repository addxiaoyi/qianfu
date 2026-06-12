import { resolveLocalPrismaClient } from '../utils/prismaClientResolver';

const PrismaClient = resolveLocalPrismaClient() as new (...args: any[]) => any;

export const prisma = new PrismaClient();
