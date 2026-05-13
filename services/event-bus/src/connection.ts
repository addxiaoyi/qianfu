/**
 * Connection Manager
 * Handles RabbitMQ connection lifecycle with automatic reconnection
 */

import amqp, { Connection, Channel } from 'amqplib';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

export interface ConnectionManagerOptions {
  url: string;
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  heartbeatInterval?: number;
}

export class ConnectionManager extends EventEmitter {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private retryCount = 0;
  private retryTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private readonly url: string;
  private readonly maxRetries: number;
  private readonly initialRetryDelay: number;
  private readonly maxRetryDelay: number;
  private readonly heartbeatInterval: number;

  constructor(options: ConnectionManagerOptions) {
    super();
    this.url = options.url;
    this.maxRetries = options.maxRetries ?? 10;
    this.initialRetryDelay = options.initialRetryDelay ?? 1000;
    this.maxRetryDelay = options.maxRetryDelay ?? 30000;
    this.heartbeatInterval = options.heartbeatInterval ?? 60;
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && this.channel !== null;
  }

  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('[ConnectionManager] Cannot connect: shutting down');
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    logger.info('[ConnectionManager] Connecting to RabbitMQ...');

    try {
      // Connection options
      const connectOptions: amqp.Options.Connect = {
        heartbeat: this.heartbeatInterval,
        timeout: 10000,
      };

      this.connection = await amqp.connect(this.url, connectOptions);
      this.channel = await this.connection.createChannel();

      // Set prefetch for fair dispatch
      await this.channel.prefetch(10);

      // Set up connection event handlers
      this.setupConnectionHandlers();

      this.retryCount = 0;
      this.setState(ConnectionState.CONNECTED);
      logger.info('[ConnectionManager] Connected to RabbitMQ');

      // Emit connected event
      this.emit('connected');
    } catch (error) {
      logger.error('[ConnectionManager] Connection failed:', error);
      this.setState(ConnectionState.ERROR);
      this.scheduleReconnect();
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    // Error handler
    this.connection.on('error', (err) => {
      logger.error('[ConnectionManager] Connection error:', err.message);
      this.emit('error', err);
    });

    // Close handler - triggers reconnection
    this.connection.on('close', () => {
      if (this.isShuttingDown) {
        logger.info('[ConnectionManager] Connection closed (shutdown)');
        return;
      }

      logger.warn('[ConnectionManager] Connection closed unexpectedly');
      this.channel = null;
      this.connection = null;
      this.setState(ConnectionState.RECONNECTING);
      this.scheduleReconnect();
    });

    // Channel error handler
    this.connection.on('error', (err) => {
      logger.error('[ConnectionManager] Channel error:', err.message);
    });

    // Channel close handler
    if (this.channel) {
      this.channel.on('close', () => {
        if (!this.isShuttingDown) {
          logger.warn('[ConnectionManager] Channel closed');
          this.channel = null;
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;
    if (this.retryCount >= this.maxRetries) {
      logger.error('[ConnectionManager] Max retries reached, giving up');
      this.setState(ConnectionState.ERROR);
      this.emit('failed', new Error('Max retries exceeded'));
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.initialRetryDelay * Math.pow(2, this.retryCount) + Math.random() * 1000,
      this.maxRetryDelay
    );

    this.retryCount++;
    this.setState(ConnectionState.RECONNECTING);

    logger.info(`[ConnectionManager] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.retryCount}/${this.maxRetries})`);

    this.retryTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  async disconnect(): Promise<void> {
    logger.info('[ConnectionManager] Disconnecting...');
    this.isShuttingDown = true;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.setState(ConnectionState.DISCONNECTED);
      logger.info('[ConnectionManager] Disconnected');
      this.emit('disconnected');
    } catch (error) {
      logger.error('[ConnectionManager] Error during disconnect:', error);
      this.channel = null;
      this.connection = null;
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      logger.debug(`[ConnectionManager] State: ${this.state} -> ${state}`);
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  getStats(): {
    state: ConnectionState;
    retryCount: number;
    isShuttingDown: boolean;
  } {
    return {
      state: this.state,
      retryCount: this.retryCount,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

export default ConnectionManager;
