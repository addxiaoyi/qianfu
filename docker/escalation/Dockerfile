# Alert Escalation Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY --from=../.. /app/server/services/escalationService.ts ./src/escalationService.ts
COPY --from=../.. /app/server/services/escalationService.d.ts ./src/escalationService.d.ts

# 复制主程序
COPY src/index.ts ./src/index.ts
COPY src/routes.ts ./src/routes.ts

# 编译
RUN npm run build

# 生产镜像
FROM node:20-alpine AS production

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制编译产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# 设置用户
USER nodejs

# 暴露端口
EXPOSE 9094

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9094/health || exit 1

# 启动命令
CMD ["node", "dist/index.js"]
