/**
 * Server Service - 主入口
 * 独立的游戏服务器管理微服务
 */

import express from 'express';
import { logger } from '@qianfu/shared';
import { serverRoutes } from './routes/server.routes';

// ============================================================================
// 应用初始化
// ============================================================================

const app = express();

// 信任代理
app.set('trust proxy', 1);

// 中间件
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 请求日志
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// ============================================================================
// 健康检查
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'server-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (_req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

    res.json({
      status: 'ready',
      checks: [{ name: 'database', status: true }],
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      checks: [{ name: 'database', status: false, error: String(error) }],
    });
  }
});

// ============================================================================
// 路由
// ============================================================================

app.use('/servers', serverRoutes);

// ============================================================================
// 错误处理
// ============================================================================

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// 启动
// ============================================================================

const PORT = parseInt(process.env.PORT || '3071');

app.listen(PORT, () => {
  logger.info(`Server Service started on port ${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV,
  });
});

export default app;
