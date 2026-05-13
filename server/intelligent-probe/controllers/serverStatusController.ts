import { Request, Response, NextFunction } from 'express';
import * as serverStatusService from '../services/serverStatusService';
import * as serverService from '../services/serverService';
import { successResponse, errorResponse } from '../utils/response';
import { validate } from '../utils/validation';
import { z } from 'zod';

// Zod schema for ServerStatus creation
const createServerStatusSchema = z.object({
  serverId: z.number(),
  online: z.boolean(),
  host: z.string(),
  port: z.number(),
  versionNameRaw: z.string().optional(),
  versionProtocol: z.number().optional(),
  playersOnline: z.number().optional(),
  playersMax: z.number().optional(),
  playersList: z.string().optional(),
  motdRaw: z.string().optional(),
  motdClean: z.string().optional(),
  motdHtml: z.string().optional(),
  favicon: z.string().optional(),
  srvRecord: z.string().optional(),
});

// Zod schema for ServerStatus update
const updateServerStatusSchema = z.object({
  online: z.boolean().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  versionNameRaw: z.string().optional(),
  versionProtocol: z.number().optional(),
  playersOnline: z.number().optional(),
  playersMax: z.number().optional(),
  playersList: z.string().optional(),
  motdRaw: z.string().optional(),
  motdClean: z.string().optional(),
  motdHtml: z.string().optional(),
  favicon: z.string().optional(),
  srvRecord: z.string().optional(),
});

export const createServerStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = validate(createServerStatusSchema, req.body);
    const { serverId, ...statusData } = validatedData;
    
    // Check ownership
    const existingServer = await serverService.getServerById(serverId);
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

    const serverStatus = await serverStatusService.createServerStatus({
      ...statusData,
      server: { connect: { id: serverId } }
    } as any);
    successResponse(res, serverStatus, 'Server status created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getServerStatusByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParam = req.params.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid ID provided', 400);
    }
    const serverStatus = await serverStatusService.getServerStatusById(id);
    if (serverStatus) {
      successResponse(res, serverStatus, 'Server status fetched successfully');
    } else {
      errorResponse(res, 'Server status not found', 404);
    }
  } catch (error) {
    next(error);
  }
};

export const getServerStatusByServerIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverIdParam = req.params.serverId;
    const serverIdStr = Array.isArray(serverIdParam) ? serverIdParam[0] : serverIdParam;
    const serverId = parseInt(serverIdStr, 10);
    if (isNaN(serverId)) {
      return errorResponse(res, 'Invalid Server ID provided', 400);
    }
    const serverStatus = await serverStatusService.getServerStatusByServerId(serverId);
    if (serverStatus) {
      successResponse(res, serverStatus, 'Server status fetched successfully by serverId');
    } else {
      errorResponse(res, 'Server status not found for given serverId', 404);
    }
  } catch (error) {
    next(error);
  }
};

export const updateServerStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParam = req.params.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid ID provided', 400);
    }
    
    // Check ownership
    const existingStatus = await serverStatusService.getServerStatusById(id);
    if (!existingStatus) {
      return errorResponse(res, 'Server status not found', 404);
    }
    const existingServer = await serverService.getServerById(existingStatus.serverId);
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

    const validatedData = validate(updateServerStatusSchema, req.body);
    const serverStatus = await serverStatusService.updateServerStatus(id, validatedData);
    successResponse(res, serverStatus, 'Server status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteServerStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParam = req.params.id;
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid ID provided', 400);
    }
    
    // Check ownership
    const existingStatus = await serverStatusService.getServerStatusById(id);
    if (!existingStatus) {
      return errorResponse(res, 'Server status not found', 404);
    }
    const existingServer = await serverService.getServerById(existingStatus.serverId);
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

    await serverStatusService.deleteServerStatus(id);
    successResponse(res, null, 'Server status deleted successfully', 204);
  } catch (error) {
    next(error);
  }
};
