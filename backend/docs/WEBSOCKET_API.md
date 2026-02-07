# BaseBook DEX - WebSocket API Documentation

## Overview

The BaseBook DEX WebSocket API provides real-time updates for prices, pool states, swaps, and liquidity events. Connect to `ws://localhost:3000/ws` (development) or `wss://api.basebook.io/ws` (production).

## Connection

### Endpoint
```
ws://localhost:3000/ws
```

### Connection Flow

1. Client connects to WebSocket endpoint
2. Server sends `connected` message with client ID and default chain
3. Client subscribes to desired channels
4. Server confirms subscriptions
5. Client receives real-time updates

### Example Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to BaseBook WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Message Types

### Client → Server Messages

#### 1. Subscribe to Channel

Subscribe to receive real-time updates for a specific channel.

```json
{
  "type": "subscribe",
  "channel": "prices:8453"
}
```

**Channels:**
- `prices:{chainId}` - Token price updates (every 10s)
- `pool:{poolId}` - Specific pool updates
- `pools:{chainId}` - All pool updates on a chain
- `swaps:{chainId}` - Live swap events
- `liquidity:{chainId}` - Live mint/burn events

#### 2. Unsubscribe from Channel

```json
{
  "type": "unsubscribe",
  "channel": "prices:8453"
}
```

#### 3. Set Chain

Change the default chain for this connection.

```json
{
  "type": "setChain",
  "chainId": 8453
}
```

#### 4. Ping

Keep connection alive and measure latency.

```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### 1. Connected

Sent immediately after connection.

```json
{
  "type": "connected",
  "data": {
    "clientId": "client_1234567890_abc123",
    "chainId": 8453
  }
}
```

#### 2. Subscribed

Confirmation of subscription.

```json
{
  "type": "subscribed",
  "channel": "prices:8453"
}
```

#### 3. Unsubscribed

Confirmation of unsubscription.

```json
{
  "type": "unsubscribed",
  "channel": "prices:8453"
}
```

#### 4. Pong

Response to ping.

```json
{
  "type": "pong"
}
```

#### 5. Error

Error message.

```json
{
  "type": "error",
  "error": "Invalid message format"
}
```

#### 6. Price Update

Real-time token price updates.

```json
{
  "type": "priceUpdate",
  "channel": "prices:8453",
  "data": {
    "prices": {
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "priceUsd": "1.00",
        "priceChange24h": "0.02"
      },
      "0x4200000000000000000000000000000000000006": {
        "address": "0x4200000000000000000000000000000000000006",
        "symbol": "WETH",
        "priceUsd": "2450.50",
        "priceChange24h": "2.35"
      }
    },
    "timestamp": 1699999999
  }
}
```

#### 7. Pool Update

Pool state changes.

```json
{
  "type": "poolUpdate",
  "channel": "pool:0x1234...",
  "data": {
    "poolId": "0x1234...",
    "sqrtPriceX96": "1234567890",
    "tick": -200345,
    "liquidity": "1000000000000000000",
    "token0Price": "2450.50",
    "token1Price": "0.000408",
    "tvlUsd": "5000000.00",
    "volume24h": "1000000.00"
  }
}
```

#### 8. Swap Event

Live swap transactions.

```json
{
  "type": "swapEvent",
  "channel": "swaps:8453",
  "data": {
    "txHash": "0xabc...",
    "poolId": "0x1234...",
    "sender": "0xdef...",
    "recipient": "0xghi...",
    "amount0": "-1000000000000000000",
    "amount1": "2450000000",
    "amountUsd": "2450.00",
    "timestamp": 1699999999
  }
}
```

#### 9. Liquidity Event

Live mint/burn events.

```json
{
  "type": "liquidityEvent",
  "channel": "liquidity:8453",
  "data": {
    "type": "mint",
    "txHash": "0xjkl...",
    "poolId": "0x1234...",
    "owner": "0xmno...",
    "tokenId": "123",
    "tickLower": -200400,
    "tickUpper": -200200,
    "liquidity": "1000000000000000000",
    "amount0": "1000000000000000000",
    "amount1": "2450000000",
    "timestamp": 1699999999
  }
}
```

## Channel Patterns

### Price Updates

**Channel:** `prices:{chainId}`

**Update Frequency:** Every 10 seconds

**Example:**
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices:8453'
}));
```

### Pool Updates

**Channel:** `pool:{poolId}` or `pools:{chainId}`

**Update Trigger:** On swap/mint/burn events

**Examples:**
```javascript
// Single pool
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'pool:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
}));

// All pools on chain
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'pools:8453'
}));
```

### Swap Events

**Channel:** `swaps:{chainId}`

**Update Trigger:** Real-time on swap transactions

**Example:**
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'swaps:8453'
}));
```

### Liquidity Events

**Channel:** `liquidity:{chainId}`

**Update Trigger:** Real-time on mint/burn transactions

**Example:**
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'liquidity:8453'
}));
```

## Keep-Alive

The server automatically disconnects inactive clients after 60 seconds. Send periodic pings to keep the connection alive:

```javascript
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000); // Every 30 seconds
```

## Error Handling

Always implement error handling:

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  // Implement reconnection logic
};
```

## Reconnection Strategy

Implement exponential backoff for reconnections:

```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connect() {
  const ws = new WebSocket('ws://localhost:3000/ws');

  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(connect, delay);
    }
  };

  ws.onopen = () => {
    reconnectAttempts = 0; // Reset on successful connection
  };
}
```

## Rate Limiting

- Maximum 100 subscriptions per client
- Maximum 10 messages per second per client
- Exceeding limits results in disconnection

## Complete Example

```javascript
class BaseBookWebSocket {
  constructor(url = 'ws://localhost:3000/ws') {
    this.url = url;
    this.ws = null;
    this.subscriptions = new Set();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected to BaseBook WebSocket');
      // Resubscribe to channels
      this.subscriptions.forEach(channel => {
        this.subscribe(channel);
      });
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(() => this.connect(), 5000);
    };

    // Start ping interval
    this.startPing();
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('Client ID:', message.data.clientId);
        break;
      case 'priceUpdate':
        console.log('Price update:', message.data.prices);
        break;
      case 'swapEvent':
        console.log('Swap event:', message.data);
        break;
      // Handle other message types...
    }
  }

  subscribe(channel) {
    this.subscriptions.add(channel);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel
      }));
    }
  }

  unsubscribe(channel) {
    this.subscriptions.delete(channel);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        channel
      }));
    }
  }

  startPing() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const client = new BaseBookWebSocket();
client.connect();
client.subscribe('prices:8453');
client.subscribe('swaps:8453');
```

## Testing

Use the provided test clients:

### HTML Client
```bash
open examples/websocket-client.html
```

### Node.js Client
```bash
node examples/websocket-client.js
```

### Load Testing
```bash
node tests/load/websocket-load-test.js --clients 1000 --duration 60
```

## Monitoring

Monitor WebSocket stats via health endpoint:

```bash
curl http://localhost:3000/health/detailed
```

Response includes:
```json
{
  "websocket": {
    "status": "healthy",
    "totalClients": 150,
    "subscriptions": {
      "prices:8453": 100,
      "swaps:8453": 50
    }
  }
}
```
