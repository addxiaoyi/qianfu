import { hookService, MotiaHook } from '../services/hookService';
import { logger } from '../utils/logger';

/**
 * HelloWorld Plugin
 * A simple example of how to use the Hook system
 */
export default function init() {
  logger.info('[Plugin:HelloWorld] Initializing...');

  // Listen for user login
  hookService.register(MotiaHook.USER_LOGIN, ({ user, ip }) => {
    logger.info(`[Plugin:HelloWorld] User ${user.username} logged in from ${ip}`);
  });

  // Listen for server creation
  hookService.register(MotiaHook.SERVER_CREATED, ({ server, user }) => {
    logger.info(`[Plugin:HelloWorld] New server "${server.name}" created by ${user.username}`);
  });

  logger.info('[Plugin:HelloWorld] Initialized successfully');
}
