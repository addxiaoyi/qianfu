import { logger } from '../utils/logger';

const MOTIA_URL = process.env.MOTIA_URL || 'http://localhost:3005';

export const emitMotiaEvent = async (event: string, payload: Record<string, unknown>) => {
  if (process.env.MOTIA_ENABLED !== 'true') return;

  try {
    // Motia router exposes an endpoint to emit events
    const response = await fetch(`${MOTIA_URL}/events/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      logger.info(`[Motia] Emitted event: ${event}`);
    } else {
      logger.warn(`[Motia] Failed to emit event ${event}: ${response.statusText}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[Motia] Failed to emit event ${event}: ${message}`);
  }
};
