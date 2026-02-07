import { useEffect, useState, useCallback } from 'react';
import {
  wsClient,
  WebSocketMessage,
  WebSocketMessageType,
  PriceUpdate,
  SwapNotification,
  PoolUpdate,
} from '@/lib/websocket/client';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: WebSocketMessage) => void;
  subscribe: (channel: string, chainId?: number) => void;
  unsubscribe: (channel: string, chainId?: number) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for WebSocket connection
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Update connection status
    const checkConnection = () => {
      setIsConnected(wsClient.isConnected());
    };

    // Register handlers
    const unsubOpen = wsClient.onOpen(checkConnection);
    const unsubClose = wsClient.onClose(checkConnection);

    // Auto-connect if enabled
    if (autoConnect && !wsClient.isConnected()) {
      wsClient.connect();
    }

    // Initial check
    checkConnection();

    return () => {
      unsubOpen();
      unsubClose();
    };
  }, [autoConnect]);

  const send = useCallback((message: WebSocketMessage) => {
    wsClient.send(message);
  }, []);

  const subscribe = useCallback((channel: string, chainId?: number) => {
    wsClient.subscribe(channel, chainId);
  }, []);

  const unsubscribe = useCallback((channel: string, chainId?: number) => {
    wsClient.unsubscribe(channel, chainId);
  }, []);

  const connect = useCallback(() => {
    wsClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return {
    isConnected,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

/**
 * Hook for price updates
 */
export function usePriceUpdates(
  onUpdate: (update: PriceUpdate) => void,
  chainId?: number
) {
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to price channel
    subscribe('prices', chainId);

    // Register handler
    const unsubHandler = wsClient.on('price_update', (message) => {
      if (message.data) {
        onUpdate(message.data as PriceUpdate);
      }
    });

    return () => {
      unsubHandler();
      unsubscribe('prices', chainId);
    };
  }, [subscribe, unsubscribe, onUpdate, chainId]);
}

/**
 * Hook for swap notifications
 */
export function useSwapNotifications(
  onNotification: (notification: SwapNotification) => void,
  chainId?: number
) {
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to swaps channel
    subscribe('swaps', chainId);

    // Register handler
    const unsubHandler = wsClient.on('swap_notification', (message) => {
      if (message.data) {
        onNotification(message.data as SwapNotification);
      }
    });

    return () => {
      unsubHandler();
      unsubscribe('swaps', chainId);
    };
  }, [subscribe, unsubscribe, onNotification, chainId]);
}

/**
 * Hook for pool updates
 */
export function usePoolUpdates(
  onUpdate: (update: PoolUpdate) => void,
  poolId?: string,
  chainId?: number
) {
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!poolId) return;

    // Subscribe to specific pool
    subscribe(`pool:${poolId}`, chainId);

    // Register handler
    const unsubHandler = wsClient.on('pool_update', (message) => {
      if (message.data) {
        const update = message.data as PoolUpdate;
        if (update.poolId === poolId) {
          onUpdate(update);
        }
      }
    });

    return () => {
      unsubHandler();
      unsubscribe(`pool:${poolId}`, chainId);
    };
  }, [subscribe, unsubscribe, onUpdate, poolId, chainId]);
}

/**
 * Hook for WebSocket message type
 */
export function useWebSocketMessage<T = unknown>(
  messageType: WebSocketMessageType,
  onMessage: (data: T) => void
) {
  useEffect(() => {
    const unsubHandler = wsClient.on(messageType, (message) => {
      if (message.data) {
        onMessage(message.data as T);
      }
    });

    return unsubHandler;
  }, [messageType, onMessage]);
}
