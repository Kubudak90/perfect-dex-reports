# Oracle API Documentation

The Oracle API provides reliable price data for tokens on BaseBook DEX. This includes spot prices and TWAP (Time-Weighted Average Price) calculations.

## Overview

In production, oracle data would be sourced from:
- **Chainlink Price Feeds** - Decentralized oracle network
- **Uniswap V3 TWAP** - On-chain time-weighted average prices
- **Multiple DEX Aggregators** - Cross-verified pricing data

**Current Implementation:** Mock data for development and testing.

## Endpoints

### Get Oracle Prices

Get current prices for one or more tokens.

**Endpoint:** `GET /v1/oracle/prices`

**Query Parameters:**
- `chainId` (optional, default: 8453) - Chain ID
- `tokens` (optional) - Comma-separated list of token addresses

**Example Request:**
```bash
# Get all token prices
curl http://localhost:3000/v1/oracle/prices?chainId=8453

# Get specific tokens
curl "http://localhost:3000/v1/oracle/prices?chainId=8453&tokens=0x4200000000000000000000000000000000000006,0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "prices": {
      "0x4200000000000000000000000000000000000006": {
        "address": "0x4200000000000000000000000000000000000006",
        "symbol": "WETH",
        "priceUsd": "2450.50",
        "priceEth": "1.0",
        "decimals": 18,
        "lastUpdated": 1699999999
      },
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "priceUsd": "1.00",
        "priceEth": "0.000408",
        "decimals": 6,
        "lastUpdated": 1699999999
      }
    },
    "timestamp": 1699999999
  }
}
```

### Get TWAP Price

Get Time-Weighted Average Price for a token over a specified period.

**Endpoint:** `GET /v1/oracle/twap/:token`

**Path Parameters:**
- `token` - Token address (e.g., 0x4200000000000000000000000000000000000006)

**Query Parameters:**
- `chainId` (optional, default: 8453) - Chain ID
- `period` (optional, default: 3600) - TWAP period in seconds

**Example Request:**
```bash
# Get 1-hour TWAP for WETH
curl http://localhost:3000/v1/oracle/twap/0x4200000000000000000000000000000000000006?period=3600

# Get 24-hour TWAP for USDC
curl http://localhost:3000/v1/oracle/twap/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913?period=86400
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "token": "0x4200000000000000000000000000000000000006",
    "symbol": "WETH",
    "twapPriceUsd": "2448.350000",
    "spotPriceUsd": "2450.50",
    "period": 3600,
    "timestamp": 1699999999
  }
}
```

## Supported Tokens (Mock Data)

| Symbol | Address | Decimals |
|--------|---------|----------|
| WETH | 0x4200000000000000000000000000000000000006 | 18 |
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 6 |
| DAI | 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb | 18 |
| WBTC | 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c | 8 |
| cbETH | 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22 | 18 |

## TWAP Periods

Common TWAP periods:
- **1 minute:** 60
- **5 minutes:** 300
- **15 minutes:** 900
- **1 hour:** 3600
- **4 hours:** 14400
- **24 hours:** 86400

## Caching

- **Oracle Prices:** 10 seconds TTL
- **TWAP Prices:** 30 seconds TTL

Prices are cached in Redis for performance. Fresh data is fetched when cache expires.

## Rate Limiting

Oracle endpoints are subject to rate limiting:
- **Public tier:** 100 requests/minute
- **Authenticated tier:** 500 requests/minute
- **Premium tier:** 2000 requests/minute

## Error Responses

### Token Not Found (404)
```json
{
  "success": false,
  "error": "Token not found",
  "code": "NOT_FOUND",
  "statusCode": 404,
  "requestId": "req-abc123",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Invalid Address (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "statusCode": 400,
  "details": [
    {
      "field": "token",
      "message": "Invalid token address",
      "code": "invalid_string"
    }
  ],
  "requestId": "req-abc123",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
// Get all oracle prices
async function getOraclePrices() {
  const response = await fetch('http://localhost:3000/v1/oracle/prices?chainId=8453');
  const data = await response.json();

  if (data.success) {
    console.log('Prices:', data.data.prices);
  }
}

// Get TWAP for a specific token
async function getTWAPPrice(tokenAddress: string, period: number = 3600) {
  const response = await fetch(
    `http://localhost:3000/v1/oracle/twap/${tokenAddress}?period=${period}`
  );
  const data = await response.json();

  if (data.success) {
    console.log('TWAP Price:', data.data.twapPriceUsd);
    console.log('Spot Price:', data.data.spotPriceUsd);
  }
}

// Get prices for specific tokens
async function getSpecificTokenPrices(tokens: string[]) {
  const tokensParam = tokens.join(',');
  const response = await fetch(
    `http://localhost:3000/v1/oracle/prices?tokens=${tokensParam}`
  );
  const data = await response.json();

  return data.data.prices;
}
```

### React Hook

```typescript
import { useEffect, useState } from 'react';

interface OraclePrice {
  address: string;
  symbol: string;
  priceUsd: string;
  priceEth: string;
  decimals: number;
  lastUpdated: number;
}

export function useOraclePrice(tokenAddress: string) {
  const [price, setPrice] = useState<OraclePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const response = await fetch(
          `http://localhost:3000/v1/oracle/prices?tokens=${tokenAddress}`
        );
        const data = await response.json();

        if (data.success) {
          setPrice(data.data.prices[tokenAddress]);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();

    // Refresh every 10 seconds
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

  return { price, loading, error };
}
```

### Python

```python
import requests

def get_oracle_prices(chain_id=8453, tokens=None):
    """Get oracle prices for tokens"""
    params = {'chainId': chain_id}
    if tokens:
        params['tokens'] = ','.join(tokens)

    response = requests.get(
        'http://localhost:3000/v1/oracle/prices',
        params=params
    )
    data = response.json()

    if data['success']:
        return data['data']['prices']
    else:
        raise Exception(data['error'])

def get_twap_price(token_address, period=3600, chain_id=8453):
    """Get TWAP price for a token"""
    response = requests.get(
        f'http://localhost:3000/v1/oracle/twap/{token_address}',
        params={'period': period, 'chainId': chain_id}
    )
    data = response.json()

    if data['success']:
        return data['data']
    else:
        raise Exception(data['error'])

# Usage
prices = get_oracle_prices(tokens=['0x4200000000000000000000000000000000000006'])
twap = get_twap_price('0x4200000000000000000000000000000000000006', period=3600)
```

## Production Implementation

In production, the oracle would:

1. **Chainlink Integration:**
   - Fetch prices from Chainlink price feeds
   - Verify data freshness (heartbeat)
   - Handle stale data scenarios

2. **Uniswap TWAP:**
   - Query Uniswap V3 observation data
   - Calculate TWAP from on-chain observations
   - Handle tick math and price conversions

3. **Multi-source Verification:**
   - Aggregate prices from multiple sources
   - Detect and filter outliers
   - Calculate median/weighted average

4. **Fallback Mechanisms:**
   - Primary: Chainlink
   - Secondary: Uniswap TWAP
   - Tertiary: Alternative DEX aggregators

5. **Price Manipulation Protection:**
   - TWAP to smooth out flash loan attacks
   - Multi-block observation windows
   - Sanity checks on price movements

## Security Considerations

1. **Price Staleness:** Always check `lastUpdated` timestamp
2. **Slippage Protection:** Use TWAP for large trades
3. **Manipulation Detection:** Compare spot vs TWAP
4. **Circuit Breakers:** Reject trades if price deviates >10% from TWAP

## Monitoring

Monitor oracle health via:
```bash
curl http://localhost:3000/health/detailed
```

Response includes oracle status:
```json
{
  "oracle": {
    "status": "healthy",
    "lastUpdate": 1699999999,
    "tokensTracked": 5
  }
}
```
