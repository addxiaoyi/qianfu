FROM node:20.19.0-alpine3.21 AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run server:build
RUN npm run build

FROM node:20.19.0-alpine3.21 AS production
WORKDIR /app

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built artifacts
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/dist-server ./dist-server
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/package-lock.json* ./

# Install production dependencies (catches all packages, not just the ones manually listed)
RUN npm ci --only=production && npm cache clean --force

COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown appuser:nodejs /app/docker-entrypoint.sh

RUN mkdir -p /app/data /app/logs && chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=file:./data/app.db

EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist-server/server/index.js"]
