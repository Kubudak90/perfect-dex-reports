import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { CacheService } from '../cache/index.js';
import { CacheKeys } from '../cache/keys.js';
import type Redis from 'ioredis';

/**
 * WebSocket client connection
 */
interface WSClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  chainId: number;
  lastPing: number;
}

/**
 * WebSocket message types
 */
export enum WSMessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PING = 'ping',
  SET_CHAIN = 'setChain',

  // Server -> Client
  CONNECTED = 'connected',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  PONG = 'pong',
  ERROR = 'error',

  // Data updates
  PRICE_UPDATE = 'priceUpdate',
  POOL_UPDATE = 'poolUpdate',
  SWAP_EVENT = 'swapEvent',
  LIQUIDITY_EVENT = 'liquidityEvent',
}

/**
 * WebSocket message structure
 */
interface WSMessage {
  type: WSMessageType;
  channel?: string;
  chainId?: number;
  data?: any;
  error?: string;
}

/**
 * WebSocket Manager
 * Handles all WebSocket connections and real-time updates
 */
export class WebSocketManager {
  private clients: Map<string, WSClient> = new Map();
  private cache: CacheService;
  private subscriber: Redis;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    private fastify: FastifyInstance,
    redis: Redis
  ) {
    this.cache = new CacheService(redis);
    this.subscriber = redis.duplicate();
    this.setupPubSub();
    this.startPingInterval();
  }

  /**
   * Register WebSocket route
   */
  async register() {
    this.fastify.get('/ws', { websocket: true }, (connection) => {
      this.handleConnection(connection);
    });

    this.fastify.log.info('WebSocket server registered at /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(connection: WebSocket) {
    const clientId = this.generateClientId();

    const client: WSClient = {
      id: clientId,
      socket: connection,
      subscriptions: new Set(),
      chainId: 8453, // Default to Base
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    this.fastify.log.info(`WebSocket client connected: ${clientId}`);

    // Send connection confirmation
    this.send(client, {
      type: WSMessageType.CONNECTED,
      data: { clientId, chainId: client.chainId },
    });

    // Handle messages
    connection.socket.on('message', (data: Buffer) => {
      this.handleMessage(client, data);
    });

    // Handle disconnection
    connection.socket.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    connection.socket.on('error', (error: Error) => {
      this.fastify.log.error(error, `WebSocket error for client ${clientId}`);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WSClient, data: Buffer) {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case WSMessageType.SUBSCRIBE:
          this.handleSubscribe(client, message.channel!);
          break;

        case WSMessageType.UNSUBSCRIBE:
          this.handleUnsubscribe(client, message.channel!);
          break;

        case WSMessageType.SET_CHAIN:
          this.handleSetChain(client, message.chainId!);
          break;

        case WSMessageType.PING:
          this.handlePing(client);
          break;

        default:
          this.send(client, {
            type: WSMessageType.ERROR,
            error: `Unknown message type: ${message.type}`,
          });
      }
    } catch (error) {
      this.fastify.log.error(error, `Failed to parse message from ${client.id}`);
      this.send(client, {
        type: WSMessageType.ERROR,
        error: 'Invalid message format',
      });
    }
  }

  /**
   * Handle subscribe request
   */
  private async handleSubscribe(client: WSClient, channel: string) {
    client.subscriptions.add(channel);

    this.fastify.log.info(`Client ${client.id} subscribed to ${channel}`);

    // Send confirmation
    this.send(client, {
      type: WSMessageType.SUBSCRIBED,
      channel,
    });

    // Send initial data
    await this.sendInitialData(client, channel);
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(client: WSClient, channel: string) {
    client.subscriptions.delete(channel);

    this.fastify.log.info(`Client ${client.id} unsubscribed from ${channel}`);

    this.send(client, {
      type: WSMessageType.UNSUBSCRIBED,
      channel,
    });
  }

  /**
   * Handle chain change
   */
  private handleSetChain(client: WSClient, chainId: number) {
    client.chainId = chainId;
    this.fastify.log.info(`Client ${client.id} changed chain to ${chainId}`);
  }

  /**
   * Handle ping
   */
  private handlePing(client: WSClient) {
    client.lastPing = Date.now();
    this.send(client, {
      type: WSMessageType.PONG,
    });
  }

  /**
   * Send initial data for a channel
   */
  private async sendInitialData(client: WSClient, channel: string) {
    try {
      const [type] = channel.split(':');

      switch (type) {
        case 'prices':
          const prices = await this.cache.get(CacheKeys.prices(client.chainId));
          if (prices) {
            this.send(client, {
              type: WSMessageType.PRICE_UPDATE,
              channel,
              data: prices,
            });
          }
          break;

        case 'pool':
          const poolId = channel.split(':')[1];
          const pool = await this.cache.get(CacheKeys.pool(client.chainId, poolId));
          if (pool) {
            this.send(client, {
              type: WSMessageType.POOL_UPDATE,
              channel,
              data: pool,
            });
          }
          break;

        default:
          // No initial data for other channels
          break;
      }
    } catch (error) {
      this.fastify.log.error(error, `Failed to send initial data for ${channel}`);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string) {
    this.clients.delete(clientId);
    this.fastify.log.info(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Send message to client
   */
  private send(client: WSClient, message: WSMessage) {
    try {
      client.socket.socket.send(JSON.stringify(message));
    } catch (error) {
      this.fastify.log.error(error, `Failed to send message to client ${client.id}`);
    }
  }

  /**
   * Broadcast message to all clients subscribed to a channel
   */
  private broadcast(channel: string, message: WSMessage) {
    let count = 0;
    for (const [_, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.send(client, message);
        count++;
      }
    }
    if (count > 0) {
      this.fastify.log.debug(`Broadcasted to ${count} clients on channel ${channel}`);
    }
  }

  /**
   * Setup Redis pub/sub for real-time updates
   */
  private setupPubSub() {
    // Subscribe to all channels
    const channels = [
      'channel:prices:*',
      'channel:pools:*',
      'channel:swaps:*',
      'channel:liquidity:*',
    ];

    // Use pattern subscribe
    channels.forEach((pattern) => {
      this.subscriber.psubscribe(pattern);
    });

    // Handle messages
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        this.fastify.log.error(error, `Failed to parse Redis message from ${channel}`);
      }
    });

    this.fastify.log.info('Redis pub/sub subscriptions established');
  }

  /**
   * Handle Redis pub/sub message
   */
  private handleRedisMessage(channel: string, data: any) {
    // Extract channel type and chain ID
    // Format: channel:type:chainId or channel:type:chainId:id
    const parts = channel.split(':');
    const type = parts[1];
    const chainId = parseInt(parts[2]);

    // Map to WebSocket message type
    let messageType: WSMessageType;
    let wsChannel: string;

    switch (type) {
      case 'prices':
        messageType = WSMessageType.PRICE_UPDATE;
        wsChannel = `prices:${chainId}`;
        break;

      case 'pools':
        messageType = WSMessageType.POOL_UPDATE;
        wsChannel = parts.length > 3 ? `pool:${parts[3]}` : `pools:${chainId}`;
        break;

      case 'swaps':
        messageType = WSMessageType.SWAP_EVENT;
        wsChannel = `swaps:${chainId}`;
        break;

      case 'liquidity':
        messageType = WSMessageType.LIQUIDITY_EVENT;
        wsChannel = `liquidity:${chainId}`;
        break;

      default:
        return;
    }

    // Broadcast to subscribed clients
    this.broadcast(wsChannel, {
      type: messageType,
      channel: wsChannel,
      data,
    });
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients) {
        // Disconnect clients that haven't pinged in 60 seconds
        if (now - client.lastPing > 60000) {
          this.fastify.log.warn(`Disconnecting inactive client: ${clientId}`);
          client.socket.socket.close();
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection stats
   */
  getStats() {
    const subscriptions: Record<string, number> = {};

    for (const [_, client] of this.clients) {
      for (const channel of client.subscriptions) {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      }
    }

    return {
      totalClients: this.clients.size,
      subscriptions,
    };
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    for (const [_, client] of this.clients) {
      client.socket.socket.close();
    }

    // Unsubscribe from Redis
    await this.subscriber.punsubscribe();
    await this.subscriber.quit();

    this.fastify.log.info('WebSocket manager shut down');
  }
}
