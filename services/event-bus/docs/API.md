# Event Bus Service API Documentation

## Overview

Event Bus Service 是千服项目的 RabbitMQ 中央枢纽，负责微服务间的异步事件通信。

**Base URL**: `http://localhost:3001`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://qianfu:password@localhost:5672` | RabbitMQ connection URL |
| `API_PORT` | `3001` | HTTP API server port |
| `API_HOST` | `0.0.0.0` | HTTP API server host |
| `LOG_LEVEL` | `info` | Winston log level |

---

## Health Endpoints

### GET /

Root endpoint with service information.

**Response 200:**
```json
{
  "service": "event-bus",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "ready": "/ready",
    "healthDetailed": "/health/detailed",
    "api": "/api"
  }
}
```

### GET /health

Basic health check.

**Response 200 (Healthy):**
```json
{
  "status": "healthy",
  "service": "event-bus",
  "timestamp": "2026-04-18T10:00:00.000Z"
}
```

**Response 503 (Unhealthy):**
```json
{
  "status": "unhealthy",
  "service": "event-bus",
  "timestamp": "2026-04-18T10:00:00.000Z"
}
```

### GET /ready

Readiness check with connection and subscription status.

**Response 200:**
```json
{
  "ready": true,
  "connection": {
    "state": "connected",
    "retryCount": 0
  },
  "subscriptions": {
    "count": 3
  },
  "timestamp": "2026-04-18T10:00:00.000Z"
}
```

### GET /health/detailed

Detailed health information with metrics.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "event-bus",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2026-04-18T10:00:00.000Z",
  "connection": {
    "state": "connected",
    "retryCount": 0,
    "isShuttingDown": false
  },
  "subscriptions": {
    "total": 5,
    "totalMessages": 1234,
    "totalErrors": 2,
    "details": [
      {
        "id": "notification-service",
        "queue": "notification-service.user",
        "messageCount": 500,
        "errorCount": 1
      }
    ]
  },
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

---

## Event Endpoints

### GET /api/events/types

List all available event types.

**Response 200:**
```json
{
  "success": true,
  "eventTypes": {
    "user": {
      "CREATED": "user.created",
      "DELETED": "user.deleted",
      "UPDATED": "user.updated"
    },
    "server": {
      "CREATED": "server.created",
      "DELETED": "server.deleted"
    },
    "payment": {
      "COMPLETED": "payment.completed",
      "FAILED": "payment.failed"
    }
  },
  "validators": [
    "user.created",
    "user.deleted",
    "user.updated",
    "server.created",
    "server.deleted",
    "payment.completed",
    "payment.failed"
  ]
}
```

### POST /api/events/publish

Publish an event to the event bus.

**Request Body:**
```json
{
  "type": "user.created",
  "payload": {
    "id": 123,
    "email": "user@example.com",
    "username": "testuser",
    "role": "user",
    "createdAt": "2026-04-18T10:00:00.000Z"
  },
  "correlationId": "uuid-xxx",
  "causationId": "uuid-yyy"
}
```

**Response 201:**
```json
{
  "success": true,
  "eventType": "user.created",
  "exchange": "user.events",
  "correlationId": "uuid-xxx"
}
```

**Error Response 400:**
```json
{
  "success": false,
  "error": "Invalid payload for event type: user.created",
  "details": {
    "id": { "_errors": ["Required"] }
  }
}
```

---

## Subscription Endpoints

### GET /api/subscriptions

List all active subscriptions.

**Response 200:**
```json
{
  "success": true,
  "totalSubscriptions": 3,
  "totalMessages": 1500,
  "totalErrors": 5,
  "subscriptions": [
    {
      "id": "audit-service",
      "queue": "audit-service",
      "exchange": "user.events",
      "routingKeys": ["#"],
      "createdAt": "2026-04-18T09:00:00.000Z",
      "messageCount": 500,
      "errorCount": 2
    }
  ]
}
```

### GET /api/subscriptions/:id

Get subscription details.

**Response 200:**
```json
{
  "success": true,
  "subscription": {
    "id": "audit-service",
    "queue": "audit-service",
    "exchange": "user.events",
    "routingKeys": ["#"],
    "createdAt": "2026-04-18T09:00:00.000Z",
    "messageCount": 500,
    "errorCount": 2
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "Subscription not found"
}
```

### POST /api/subscriptions

Create a new subscription.

**Request Body:**
```json
{
  "id": "my-service",
  "queue": "my-service.events",
  "exchange": "user.events",
  "routingKeys": ["user.created", "user.updated"],
  "deadLetterExchange": "dlx.events",
  "deadLetterRoutingKey": "dlq.my-service",
  "messageTTL": 86400000
}
```

**Response 201:**
```json
{
  "success": true,
  "subscription": {
    "id": "my-service",
    "queue": "my-service.events",
    "exchange": "user.events",
    "routingKeys": ["user.created", "user.updated"],
    "createdAt": "2026-04-18T10:00:00.000Z",
    "messageCount": 0,
    "errorCount": 0
  }
}
```

### DELETE /api/subscriptions/:id

Remove a subscription.

**Response 200:**
```json
{
  "success": true,
  "message": "Subscription deleted"
}
```

---

## Event Types

### User Events

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `user.created` | User account created | `id`, `email`, `role`, `createdAt` |
| `user.updated` | User account updated | `id`, `email`, `changes`, `updatedAt` |
| `user.deleted` | User account deleted | `id`, `email`, `deletedAt` |

### Server Events

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `server.created` | Server created | `id`, `ownerId`, `name`, `createdAt` |
| `server.deleted` | Server deleted | `id`, `ownerId`, `name`, `deletedAt` |

### Payment Events

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `payment.completed` | Payment successful | `id`, `userId`, `amount`, `planId`, `completedAt` |
| `payment.failed` | Payment failed | `id`, `userId`, `amount`, `planId`, `failedAt` |

---

## Exchanges

| Exchange | Type | Routing Keys |
|----------|------|--------------|
| `user.events` | topic | `user.*`, `auth.*` |
| `server.events` | topic | `server.*` |
| `payment.events` | topic | `payment.*`, `wallet.*` |
| `notification.events` | topic | `notification.*` |
| `audit.events` | fanout | `#` (all) |
| `dlx.events` | topic | Dead letter exchange |

---

## Connection States

| State | Description |
|-------|-------------|
| `disconnected` | Not connected |
| `connecting` | Connection in progress |
| `connected` | Successfully connected |
| `reconnecting` | Attempting to reconnect |
| `error` | Connection error |

---

## Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| 400 | Invalid request body | Request validation failed |
| 404 | Not found | Resource not found |
| 409 | Conflict | Subscription already exists |
| 503 | Service unavailable | Event bus not connected |
| 500 | Internal server error | Unexpected error |
