/**
 * Event Bus Event Types
 * Central type definitions for all events flowing through the event bus
 */

import { z } from 'zod';

// ============================================
// Event Type Constants
// ============================================

export const USER_EVENT_TYPES = {
  CREATED: 'user.created',
  DELETED: 'user.deleted',
  UPDATED: 'user.updated',
} as const;

export const SERVER_EVENT_TYPES = {
  CREATED: 'server.created',
  DELETED: 'server.deleted',
} as const;

export const PAYMENT_EVENT_TYPES = {
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
} as const;

// ============================================
// Event Payload Schemas
// ============================================

/**
 * User Created Event Payload
 */
export const UserCreatedEventSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  username: z.string().optional(),
  role: z.string(),
  createdAt: z.string().datetime(),
});

export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;

/**
 * User Deleted Event Payload
 */
export const UserDeletedEventSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  deletedAt: z.string().datetime(),
  reason: z.string().optional(),
});

export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

/**
 * User Updated Event Payload
 */
export const UserUpdatedEventSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  changes: z.record(z.unknown()),
  updatedAt: z.string().datetime(),
});

export type UserUpdatedEvent = z.infer<typeof UserUpdatedEventSchema>;

/**
 * Server Created Event Payload
 */
export const ServerCreatedEventSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  name: z.string(),
  ip: z.string().optional(),
  port: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
});

export type ServerCreatedEvent = z.infer<typeof ServerCreatedEventSchema>;

/**
 * Server Deleted Event Payload
 */
export const ServerDeletedEventSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  name: z.string(),
  deletedAt: z.string().datetime(),
  reason: z.string().optional(),
});

export type ServerDeletedEvent = z.infer<typeof ServerDeletedEventSchema>;

/**
 * Payment Completed Event Payload
 */
export const PaymentCompletedEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().default('CNY'),
  planId: z.string(),
  paymentMethod: z.string(),
  completedAt: z.string().datetime(),
  transactionId: z.string().optional(),
});

export type PaymentCompletedEvent = z.infer<typeof PaymentCompletedEventSchema>;

/**
 * Payment Failed Event Payload
 */
export const PaymentFailedEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().default('CNY'),
  planId: z.string(),
  paymentMethod: z.string(),
  failedAt: z.string().datetime(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type PaymentFailedEvent = z.infer<typeof PaymentFailedEventSchema>;

// ============================================
// Unified Event Interface
// ============================================

export interface BaseEvent<T = unknown> {
  type: string;
  payload: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  timestamp: string;
  version: string;
  source: string;
}

// ============================================
// Event Factory Functions
// ============================================

export function createUserCreatedEvent(
  payload: UserCreatedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<UserCreatedEvent> {
  return createEvent(USER_EVENT_TYPES.CREATED, payload, options);
}

export function createUserDeletedEvent(
  payload: UserDeletedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<UserDeletedEvent> {
  return createEvent(USER_EVENT_TYPES.DELETED, payload, options);
}

export function createUserUpdatedEvent(
  payload: UserUpdatedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<UserUpdatedEvent> {
  return createEvent(USER_EVENT_TYPES.UPDATED, payload, options);
}

export function createServerCreatedEvent(
  payload: ServerCreatedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<ServerCreatedEvent> {
  return createEvent(SERVER_EVENT_TYPES.CREATED, payload, options);
}

export function createServerDeletedEvent(
  payload: ServerDeletedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<ServerDeletedEvent> {
  return createEvent(SERVER_EVENT_TYPES.DELETED, payload, options);
}

export function createPaymentCompletedEvent(
  payload: PaymentCompletedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<PaymentCompletedEvent> {
  return createEvent(PAYMENT_EVENT_TYPES.COMPLETED, payload, options);
}

export function createPaymentFailedEvent(
  payload: PaymentFailedEvent,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<PaymentFailedEvent> {
  return createEvent(PAYMENT_EVENT_TYPES.FAILED, payload, options);
}

// ============================================
// Event Validator Functions
// ============================================

export function validateUserCreatedEvent(event: unknown): UserCreatedEvent {
  const result = UserCreatedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid UserCreatedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validateUserDeletedEvent(event: unknown): UserDeletedEvent {
  const result = UserDeletedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid UserDeletedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validateUserUpdatedEvent(event: unknown): UserUpdatedEvent {
  const result = UserUpdatedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid UserUpdatedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validateServerCreatedEvent(event: unknown): ServerCreatedEvent {
  const result = ServerCreatedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid ServerCreatedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validateServerDeletedEvent(event: unknown): ServerDeletedEvent {
  const result = ServerDeletedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid ServerDeletedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validatePaymentCompletedEvent(event: unknown): PaymentCompletedEvent {
  const result = PaymentCompletedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid PaymentCompletedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

export function validatePaymentFailedEvent(event: unknown): PaymentFailedEvent {
  const result = PaymentFailedEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid PaymentFailedEvent: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
}

// ============================================
// Internal Event Factory
// ============================================

function createEvent<T>(
  type: string,
  payload: T,
  options?: { correlationId?: string; causationId?: string }
): BaseEvent<T> {
  return {
    type,
    payload,
    metadata: {
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'event-bus',
    },
  };
}

// ============================================
// Type Exports for Runtime Type Checking
// ============================================

export const EVENT_VALIDATORS: Record<string, z.ZodSchema> = {
  [USER_EVENT_TYPES.CREATED]: UserCreatedEventSchema,
  [USER_EVENT_TYPES.DELETED]: UserDeletedEventSchema,
  [USER_EVENT_TYPES.UPDATED]: UserUpdatedEventSchema,
  [SERVER_EVENT_TYPES.CREATED]: ServerCreatedEventSchema,
  [SERVER_EVENT_TYPES.DELETED]: ServerDeletedEventSchema,
  [PAYMENT_EVENT_TYPES.COMPLETED]: PaymentCompletedEventSchema,
  [PAYMENT_EVENT_TYPES.FAILED]: PaymentFailedEventSchema,
};

export function validateEvent(event: unknown): BaseEvent {
  if (!event || typeof event !== 'object') {
    throw new Error('Invalid event: must be an object');
  }

  const typedEvent = event as BaseEvent;

  if (!typedEvent.type || typeof typedEvent.type !== 'string') {
    throw new Error('Invalid event: missing or invalid type field');
  }

  const validator = EVENT_VALIDATORS[typedEvent.type];
  if (validator) {
    validator.parse(typedEvent.payload);
  }

  return typedEvent;
}
