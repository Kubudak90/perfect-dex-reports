# BaseBook Frontend - Backend Integration Guide

## 📋 Overview

This document describes the integration between the BaseBook frontend and backend services.

## 🔗 Deployed Contract Addresses (Base Sepolia)

| Contract | Address | Status |
|----------|---------|--------|
| **PoolManager** | `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` | ✅ Deployed |
| **SwapRouter** | `0xFf438e2d528F55fD1141382D1eB436201552d1A5` | ✅ Deployed |
| **Quoter** | `0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b` | ✅ Deployed |
| **PositionManager** | `0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA` | ✅ Deployed |

Contract addresses are configured in:
- `src/lib/constants/addresses.ts`
- `.env.local` (environment variables)

## 🌐 API Configuration

### Base URLs

```env
# HTTP API
NEXT_PUBLIC_API_URL=http://localhost:3001/v1

# WebSocket
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### API Client

Located in `src/lib/api/client.ts`:

```typescript
import { apiClient } from '@/lib/api/client';

// GET request
const pools = await apiClient.get('/pools');

// POST request
const quote = await apiClient.post('/swap/quote', {
  tokenIn: '0x...',
  tokenOut: '0x...',
  amountIn: '1000000000000000000',
});
```

### Available Endpoints

#### Swap
- `POST /v1/swap/quote` - Get swap quote
- `POST /v1/swap/route` - Get optimal route
- `POST /v1/swap/build-tx` - Build transaction

#### Pools
- `GET /v1/pools` - List all pools
- `GET /v1/pools/:poolId` - Get pool details
- `GET /v1/pools/:poolId/ticks` - Get tick data
- `GET /v1/pools/:poolId/transactions` - Get pool transactions

#### Tokens
- `GET /v1/tokens` - List all tokens
- `GET /v1/tokens/:address` - Get token details
- `GET /v1/tokens/:address/price` - Get token price
- `GET /v1/tokens/search?q=ETH` - Search tokens

#### Positions
- `GET /v1/positions/owner/:owner` - Get user positions
- `GET /v1/positions/:tokenId` - Get position details

#### Analytics
- `GET /v1/analytics/overview` - Protocol overview
- `GET /v1/analytics/volume` - Volume data
- `GET /v1/analytics/tvl` - TVL data
- `GET /v1/analytics/fees` - Fees data
- `GET /v1/analytics/top-pools` - Top pools
- `GET /v1/analytics/top-tokens` - Top tokens

## 🔌 WebSocket Integration

### WebSocket Client

Located in `src/lib/websocket/client.ts`:

```typescript
import { wsClient } from '@/lib/websocket/client';

// Connect
wsClient.connect();

// Subscribe to prices
wsClient.subscribe('prices', 8453);

// Listen for price updates
wsClient.on('price_update', (message) => {
  console.log('Price update:', message.data);
});

// Disconnect
wsClient.disconnect();
```

### WebSocket Hooks

Located in `src/hooks/common/useWebSocket.ts`:

#### Basic WebSocket Hook
```typescript
import { useWebSocket } from '@/hooks/common/useWebSocket';

function MyComponent() {
  const { isConnected, subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      subscribe('prices', 8453);
    }
  }, [isConnected, subscribe]);

  return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
}
```

#### Price Updates Hook
```typescript
import { usePriceUpdates } from '@/hooks/common/useWebSocket';

function TokenPrice({ token }) {
  const [price, setPrice] = useState('0');

  usePriceUpdates((update) => {
    if (update.token === token) {
      setPrice(update.priceUsd);
    }
  }, 8453);

  return <div>${price}</div>;
}
```

#### Swap Notifications Hook
```typescript
import { useSwapNotifications } from '@/hooks/common/useWebSocket';

function SwapFeed() {
  const [swaps, setSwaps] = useState([]);

  useSwapNotifications((notification) => {
    setSwaps(prev => [notification, ...prev]);
  }, 8453);

  return (
    <div>
      {swaps.map(swap => (
        <div key={swap.txHash}>{swap.txHash}</div>
      ))}
    </div>
  );
}
```

#### Pool Updates Hook
```typescript
import { usePoolUpdates } from '@/hooks/common/useWebSocket';

function PoolLive({ poolId }) {
  const [poolState, setPoolState] = useState(null);

  usePoolUpdates((update) => {
    setPoolState(update);
  }, poolId, 8453);

  return <div>Tick: {poolState?.tick}</div>;
}
```

### WebSocket Message Types

```typescript
// Price Update
{
  type: 'price_update',
  data: {
    token: '0x...',
    priceUsd: '2450.50',
    chainId: 8453,
    timestamp: 1699999999
  }
}

// Swap Notification
{
  type: 'swap_notification',
  data: {
    poolId: '0x...',
    txHash: '0x...',
    tokenIn: '0x...',
    tokenOut: '0x...',
    amountIn: '1000000000000000000',
    amountOut: '2450500000',
    chainId: 8453,
    timestamp: 1699999999
  }
}

// Pool Update
{
  type: 'pool_update',
  data: {
    poolId: '0x...',
    sqrtPriceX96: '...',
    tick: -200345,
    liquidity: '...',
    chainId: 8453,
    timestamp: 1699999999
  }
}
```

## 🔐 Authentication

Currently, the API does not require authentication for read operations. Write operations (if any) will require wallet signature.

## 🚀 Getting Started

### 1. Configure Environment

Copy `.env.example` to `.env.local` and update:

```bash
cp .env.example .env.local
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Verify Integration

Check API health:
```bash
curl http://localhost:3001/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1699999999
}
```

## 📊 Data Flow

### Swap Flow

```
User Input → Frontend
           ↓
    Quote Request (HTTP)
           ↓
       Backend API
           ↓
    Rust Router Engine
           ↓
    Quote Response
           ↓
       Frontend
           ↓
    User Approval
           ↓
    Transaction Build
           ↓
    Wallet Sign & Send
           ↓
    On-chain Execution
           ↓
    WebSocket Update
           ↓
    Frontend Update
```

### Price Updates Flow

```
Blockchain Event
       ↓
   Indexer
       ↓
   PostgreSQL
       ↓
  Redis Pub/Sub
       ↓
WebSocket Server
       ↓
  Frontend Client
       ↓
    UI Update
```

## 🛠️ Development

### Mock Mode

By default, the frontend uses mock data for development. To use real backend:

1. Start backend server
2. Update `.env.local` with correct API URL
3. Backend will automatically be used if available

### Testing API Integration

```typescript
import { checkApiHealth } from '@/lib/api/client';

const isAvailable = await checkApiHealth();
console.log('API available:', isAvailable);
```

### Testing WebSocket

```typescript
import { wsClient } from '@/lib/websocket/client';

wsClient.connect();
console.log('Connected:', wsClient.isConnected());
```

## 🐛 Troubleshooting

### API Connection Issues

1. Check backend is running:
   ```bash
   curl http://localhost:3001/v1/health
   ```

2. Check CORS settings in backend

3. Verify `.env.local` has correct URL

### WebSocket Connection Issues

1. Check WebSocket server is running

2. Check browser console for WebSocket errors

3. Verify URL scheme (ws:// not http://)

4. Check firewall settings

### Contract Call Issues

1. Verify contract addresses in `addresses.ts`

2. Check wallet is connected to correct network

3. Verify chain ID matches deployed contracts

## 📚 Additional Resources

- [Backend API Documentation](../backend/README.md)
- [Smart Contracts Documentation](../contracts/README.md)
- [Deployment Guide](../DEPLOYMENT.md)

## ✅ Integration Checklist

- [x] Contract addresses configured
- [x] API client implemented
- [x] WebSocket client implemented
- [x] Environment variables set
- [x] API config centralized
- [x] WebSocket hooks created
- [x] Error handling implemented
- [ ] Backend API running
- [ ] WebSocket server running
- [ ] End-to-end swap flow tested
- [ ] Real-time updates tested

---

**Status**: ✅ Frontend integration complete, ready for backend connection
**Last Updated**: 2024
**Version**: 1.0.0
