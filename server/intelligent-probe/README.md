# Intelligent Probe Service

This is a backend service dedicated to probing Minecraft server status.

## Key Features

- **Intelligent Probing**: Supports both Java and Bedrock edition server probing.
- **Auto Retry**: Automatically performs 2 retries with a 1-second interval when probing fails.
- **DNS Pre-check**: Performs DNS resolution checks before probing and returns detailed reasons like "DNS resolution failed" directly to the frontend.
- **Data Persistence**: Uses Prisma to store probed server status into the database.
- **Compatibility**: Response structure remains consistent with `api.mcstatus.io`, facilitating seamless frontend transitions.

## Tech Stack

- **Framework**: Express.js
- **ORM**: Prisma
- **Probing Library**: `minecraft-server-util` (stable and supports Java/Bedrock)
- **Validation**: Zod
- **Testing**: Vitest

## How to Run

```bash
# Start service (default port 3452)
npm run start:probe
```

## API Endpoints

- `GET /api/intelligent-probe/status?host=IP:PORT`: Get real-time status of a specific server.
- `GET /api/intelligent-probe/servers`: Get all saved servers.
- `POST /api/intelligent-probe/servers`: Add a new server.
- `GET /api/intelligent-probe/statuses`: Get all probe records.

## Auto-refresh Logic (Frontend)

The frontend uses the `useBufferedFetch` Hook to implement:
1. **Initial Load**: Automatically probes when the page is opened.
2. **Failure Retry**: If probing fails, automatically retries every 5 seconds.
3. **Timed Refresh**: If probing is successful, automatically updates data every 60 seconds.
4. **Status Caching**: Uses `localStorage` to cache the last successful probe result, ensuring users can still see data during network instability.
