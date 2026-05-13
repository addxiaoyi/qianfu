import * as serverService from '../services/serverService';
import { successResponse, errorResponse } from '../utils/response.js';
import { validate, validateHost, validateUrl, isSafeHostname } from '../utils/validation.js';
import { z } from 'zod';
// Zod schema for Server creation
const createServerSchema = z.object({
    owner_id: z.number(),
    name: z.string().min(2).max(100),
    name_en: z.string().optional(),
    thumbnail: z.string().url().optional().refine(val => !val || !validateUrl(val), { message: "Invalid or forbidden thumbnail URL" }),
    summary: z.string().max(500).optional(),
    summary_en: z.string().max(500).optional(),
    content_html: z.string().optional(),
    ip: z.string().optional().refine(val => !val || !validateHost(val), { message: "Invalid or forbidden IP/Hostname" }),
    group_number: z.string().max(50).optional(),
    tags: z.string().optional(),
    link: z.string().url().optional().or(z.literal("")).refine(val => !val || !validateUrl(val), { message: "Invalid or forbidden link URL" }),
    activity: z.number().optional(),
    synced_at: z.string().datetime().optional(),
});
// Zod schema for Server update
const updateServerSchema = z.object({
    owner_id: z.number().optional(),
    name: z.string().min(2).max(100).optional(),
    name_en: z.string().optional(),
    thumbnail: z.string().url().optional().refine(val => !val || !validateUrl(val), { message: "Invalid or forbidden thumbnail URL" }),
    summary: z.string().max(500).optional(),
    summary_en: z.string().max(500).optional(),
    content_html: z.string().optional(),
    ip: z.string().optional().refine(val => !val || !validateHost(val), { message: "Invalid or forbidden IP/Hostname" }),
    group_number: z.string().max(50).optional(),
    tags: z.string().optional(),
    link: z.string().url().optional().or(z.literal("")).refine(val => !val || !validateUrl(val), { message: "Invalid or forbidden link URL" }),
    activity: z.number().optional(),
    synced_at: z.string().datetime().optional(),
});
export const createServerController = async (req, res, next) => {
    try {
        const validatedData = validate(createServerSchema, req.body);
        // Transform owner_id to Prisma relation format
        const { owner_id, ...rest } = validatedData;
        // Security check: only allow assigning owner_id to current user or if admin
        const user = req.user;
        if (!user) {
            return errorResponse(res, 'Authentication required', 401);
        }
        if (owner_id !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 'Cannot create server for another user', 403);
        }
        // Deep SSRF check for IP/Hostname
        if (rest.ip && !await isSafeHostname(rest.ip)) {
            return errorResponse(res, 'Access to internal network addresses is forbidden', 400);
        }
        const server = await serverService.createServer({
            ...rest,
            owner: { connect: { id: owner_id } }
        });
        successResponse(res, server, 'Server created successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
export const getServerByIdController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const server = await serverService.getServerById(Number(id));
        if (server) {
            successResponse(res, server, 'Server fetched successfully');
        }
        else {
            errorResponse(res, 'Server not found', 404);
        }
    }
    catch (error) {
        next(error);
    }
};
export const getAllServersController = async (req, res, next) => {
    try {
        const servers = await serverService.getAllServers();
        successResponse(res, servers, 'Servers fetched successfully');
    }
    catch (error) {
        next(error);
    }
};
export const updateServerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validatedData = validate(updateServerSchema, req.body);
        // Check ownership
        const existingServer = await serverService.getServerById(Number(id));
        if (!existingServer) {
            return errorResponse(res, 'Server not found', 404);
        }
        const user = req.user;
        if (!user) {
            return errorResponse(res, 'Authentication required', 401);
        }
        if (existingServer.owner_id !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 'Permission denied', 403);
        }
        // Deep SSRF check for IP/Hostname if updated
        if (validatedData.ip && !await isSafeHostname(validatedData.ip)) {
            return errorResponse(res, 'Access to internal network addresses is forbidden', 400);
        }
        // Security check: only allow assigning owner_id to current user or if admin
        if (validatedData.owner_id && validatedData.owner_id !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 'Cannot assign server to another user', 403);
        }
        // Transform owner_id to Prisma relation format if provided
        const updateData = { ...validatedData };
        if (validatedData.owner_id) {
            delete updateData.owner_id;
            updateData.owner = { connect: { id: validatedData.owner_id } };
        }
        const server = await serverService.updateServer(Number(id), updateData);
        successResponse(res, server, 'Server updated successfully');
    }
    catch (error) {
        next(error);
    }
};
export const deleteServerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check ownership
        const existingServer = await serverService.getServerById(Number(id));
        if (!existingServer) {
            return errorResponse(res, 'Server not found', 404);
        }
        const user = req.user;
        if (!user) {
            return errorResponse(res, 'Authentication required', 401);
        }
        if (existingServer.owner_id !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 'Unauthorized', 403);
        }
        await serverService.deleteServer(Number(id));
        successResponse(res, null, 'Server deleted successfully', 204);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=serverController.js.map