import express from 'express';
import dotenv from 'dotenv';

import { initSuperTokens } from './supertokens/initSuperTokens';
import { initializeMiddlewareLayers } from './bootstrap/middlewareLayers';

// Load env vars
dotenv.config();
initSuperTokens();

const app = express();
app.set('trust proxy', 1);

// 使用分层中间件架构
initializeMiddlewareLayers(app);

export default app;
