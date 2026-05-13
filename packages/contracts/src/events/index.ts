/**
 * QianFu Service Events
 * Event definitions for inter-service communication
 */

import { z } from 'zod';

// ============================================
// Event Metadata
// ============================================

export const EventMetadataSchema = z.object({
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  timestamp: z.string().datetime(),
  version: z.string().default('1.0'),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

// ============================================
// Base Event
// ============================================

export interface BaseEvent<T = unknown> {
  type: string;
  payload: T;
  metadata: EventMetadata;
}

// ============================================
// User Events
// ============================================

export const USER_EVENT_TYPES = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  EMAIL_VERIFIED: 'user.email_verified',
  PASSWORD_CHANGED: 'user.password_changed',
  ROLE_CHANGED: 'user.role_changed',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
} as const;

export const UserEventPayloadSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  username: z.string().optional(),
  role: z.string(),
  emailVerified: z.boolean().optional(),
});

export const LoginEventPayloadSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().email(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  method: z.enum(['password', 'github', 'qq', 'email_code']),
});

export type UserEventPayload = z.infer<typeof UserEventPayloadSchema>;
export type LoginEventPayload = z.infer<typeof LoginEventPayloadSchema>;

// ============================================
// Server Events
// ============================================

export const SERVER_EVENT_TYPES = {
  CREATED: 'server.created',
  UPDATED: 'server.updated',
  DELETED: 'server.deleted',
  REVIEWED: 'server.reviewed',
  STATUS_CHANGED: 'server.status_changed',
  ACTIVITY_UPDATED: 'server.activity_updated',
} as const;

export const ServerEventPayloadSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  name: z.string(),
  ip: z.string().optional(),
  port: z.number().int().positive().optional(),
  reviewStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export type ServerEventPayload = z.infer<typeof ServerEventPayloadSchema>;

// ============================================
// Payment Events
// ============================================

export const PAYMENT_EVENT_TYPES = {
  CREATED: 'payment.created',
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
  WALLET_TOP_UP: 'wallet.top_up',
  WALLET_WITHDRAW: 'wallet.withdraw',
} as const;

export const PaymentEventPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.number().int().positive(),
  amount: z.number(),
  currency: z.string().default('CNY'),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  planId: z.string(),
  paymentMethod: z.string(),
});

export const WalletEventPayloadSchema = z.object({
  userId: z.number().int().positive(),
  transactionId: z.string().uuid(),
  amount: z.number(),
  balanceBefore: z.number(),
  balanceAfter: z.number(),
  type: z.enum(['DEPOSIT', 'PAYMENT', 'REFUND', 'ADJUSTMENT']),
});

export type PaymentEventPayload = z.infer<typeof PaymentEventPayloadSchema>;
export type WalletEventPayload = z.infer<typeof WalletEventPayloadSchema>;

// ============================================
// Notification Events
// ============================================

export const NOTIFICATION_EVENT_TYPES = {
  EMAIL_VERIFICATION: 'notification.email_verification',
  PASSWORD_RESET: 'notification.password_reset',
  TICKET_CREATED: 'notification.ticket_created',
  TICKET_REPLIED: 'notification.ticket_replied',
  SERVER_APPROVED: 'notification.server_approved',
  SERVER_REJECTED: 'notification.server_rejected',
  PAYMENT_RECEIVED: 'notification.payment_received',
} as const;

export const NotificationEventPayloadSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().email().optional(),
  type: z.string(),
  subject: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type NotificationEventPayload = z.infer<typeof NotificationEventPayloadSchema>;

// ============================================
// Event Factory
// ============================================

export function createEvent<T>(
  type: string,
  payload: T,
  options?: {
    correlationId?: string;
    causationId?: string;
  }
): BaseEvent<T> {
  return {
    type,
    payload,
    metadata: {
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  };
}

// ============================================
// Event Validation
// ============================================

export function validateEvent<T extends z.ZodTypeAny>(
  schema: T,
  event: unknown
): z.infer<T> {
  const result = schema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid event payload: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}
