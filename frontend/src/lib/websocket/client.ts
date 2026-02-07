/**
 * WebSocket Client for BaseBook Backend
 * Handles real-time price updates, swap notifications, and pool updates
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const isDev = process.env.NODE_ENV !== 'production';

export type WebSocketMessageType =
  | 'price_update'
  | 'swap_notification'
  | 'pool_update'
  | 'position_update'
  | 'subscribe'
  | 'unsubscribe'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: unknown;
  timestamp?: number;
}

export interface PriceUpdate {
  token: string;
  priceUsd: string;
  chainId: number;
  timestamp: number;
}

export interface SwapNotification {
  poolId: string;
  txHash: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
  timestamp: number;
}

export interface PoolUpdate {
  poolId: string;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  chainId: number;
  timestamp: number;
}

type MessageHandler = (message: WebSocketMessage) => void;
type EventHandler = (event: Event) => void;

/**
 * WebSocket Client
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private pingInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private openHandlers: Set<EventHandler> = new Set();
  private closeHandlers: Set<EventHandler> = new Set();
  private errorHandlers: Set<EventHandler> = new Set();

  constructor(url: string = WS_URL) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (isDev) console.log('[WebSocket] Already connected');
      return;
    }

    try {
      if (isDev) console.log(`[WebSocket] Connecting to ${this.url}...`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = (event) => {
        if (isDev) console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startPing();
        this.openHandlers.forEach((handler) => handler(event));
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          if (isDev) console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (event) => {
        if (isDev) console.error('[WebSocket] Error:', event);
        this.errorHandlers.forEach((handler) => handler(event));
      };

      this.ws.onclose = (event) => {
        if (isDev) console.log('[WebSocket] Disconnected');
        this.stopPing();
        this.closeHandlers.forEach((handler) => handler(event));

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          if (isDev) console.log(
            `[WebSocket] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => this.connect(), this.reconnectDelay);
          this.reconnectDelay *= 2; // Exponential backoff
        }
      };
    } catch (error) {
      if (isDev) console.error('[WebSocket] Failed to connect:', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.stopPing();
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      if (isDev) console.warn('[WebSocket] Cannot send message: not connected');
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, chainId?: number): void {
    this.send({
      type: 'subscribe',
      data: { channel, chainId },
      timestamp: Date.now(),
    });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, chainId?: number): void {
    this.send({
      type: 'unsubscribe',
      data: { channel, chainId },
      timestamp: Date.now(),
    });
  }

  /**
   * Register message handler for specific message type
   */
  on(messageType: WebSocketMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(messageType)?.delete(handler);
    };
  }

  /**
   * Register open handler
   */
  onOpen(handler: EventHandler): () => void {
    this.openHandlers.add(handler);
    return () => {
      this.openHandlers.delete(handler);
    };
  }

  /**
   * Register close handler
   */
  onClose(handler: EventHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /**
   * Register error handler
   */
  onError(handler: EventHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'pong', timestamp: Date.now() });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket ready state
   */
  getReadyState(): number | undefined {
    return this.ws?.readyState;
  }
}

/**
 * Singleton instance
 */
export const wsClient = new WebSocketClient();

/**
 * Auto-connect on client side
 */
if (typeof window !== 'undefined') {
  // Connect after page load
  window.addEventListener('load', () => {
    wsClient.connect();
  });

  // Disconnect on page unload
  window.addEventListener('beforeunload', () => {
    wsClient.disconnect();
  });
}
