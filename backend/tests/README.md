# Backend API Integration Tests

Integration tests for BaseBook DEX backend API using Vitest.

## 📁 Structure

```
backend/tests/
├── integration/
│   └── api.test.ts           # API endpoint integration tests
└── unit/
    └── (unit tests here)      # Unit tests for individual modules
```

## 🚀 Running Tests

### Run All Tests

```bash
npm run test
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run in Watch Mode

```bash
npm run test:watch
```

### Run with Coverage

```bash
npm run test:coverage
```

## 📊 Test Coverage

### Health Check API
- ✅ GET /health - Health check endpoint

### Token API
- ✅ GET /api/v1/tokens - Get token list
- ✅ GET /api/v1/tokens/:address - Get token by address
- ✅ GET /api/v1/tokens/search - Search tokens
- ✅ GET /api/v1/tokens/:address/price - Get token price
- ✅ Error handling for non-existent tokens

### Pool API
- ✅ GET /api/v1/pools - Get pool list
- ✅ GET /api/v1/pools/:id - Get pool by ID
- ✅ GET /api/v1/pools/:id/stats - Get pool statistics
- ✅ GET /api/v1/pools/:id/chart - Get pool chart data
- ✅ Sorting by TVL and volume
- ✅ Pagination support

### Swap API
- ✅ GET /api/v1/swap/quote - Get swap quote
- ✅ POST /api/v1/swap/build - Build swap transaction
- ✅ Error handling for invalid tokens
- ✅ Error handling for insufficient liquidity
- ✅ Gas estimation

### Position API
- ✅ GET /api/v1/positions - Get user positions
- ✅ GET /api/v1/positions/:tokenId - Get position by token ID

### Analytics API
- ✅ GET /api/v1/analytics/overview - Protocol overview
- ✅ GET /api/v1/analytics/volume - Volume chart data
- ✅ GET /api/v1/analytics/top-pools - Top pools by TVL
- ✅ GET /api/v1/analytics/trending-tokens - Trending tokens

### Error Handling & Security
- ✅ Rate limiting
- ✅ CORS handling
- ✅ Input validation
- ✅ 404 for non-existent routes
- ✅ 400 for invalid parameters
- ✅ 500 error handling

## 🛠️ Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';

describe('Feature Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should do something', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/endpoint',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ... });
  });
});
```

### Testing POST Endpoints

```typescript
it('should create resource', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/resource',
    payload: {
      field1: 'value1',
      field2: 'value2',
    },
  });

  expect(response.statusCode).toBe(201);
});
```

### Testing with Query Parameters

```typescript
it('should filter results', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/pools',
    query: {
      chainId: '8453',
      sortBy: 'tvl',
      limit: '10',
    },
  });

  expect(response.statusCode).toBe(200);
});
```

### Testing Error Cases

```typescript
it('should return 400 for invalid input', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/swap/quote',
    query: {
      chainId: 'invalid',
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().error).toBeDefined();
});
```

## 🎯 Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests.

### 2. Use Descriptive Names

```typescript
// Good ✅
it('should return 404 when token does not exist', async () => {});

// Bad ❌
it('test1', async () => {});
```

### 3. Test Both Success and Failure

```typescript
describe('Token API', () => {
  it('should get token successfully', async () => {
    // Success case
  });

  it('should return 404 for non-existent token', async () => {
    // Error case
  });
});
```

### 4. Use Meaningful Assertions

```typescript
// Good ✅
expect(response.statusCode).toBe(200);
expect(response.json().symbol).toBe('USDC');
expect(response.json().decimals).toBe(6);

// Bad ❌
expect(response).toBeDefined();
```

### 5. Mock External Dependencies

```typescript
import { vi } from 'vitest';

vi.mock('../../src/services/blockchain', () => ({
  getTokenPrice: vi.fn(() => Promise.resolve(2450.50)),
}));
```

## 🔧 Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
      ],
    },
  },
});
```

## 📈 Coverage Goals

- Overall: > 80%
- Critical paths: > 95%
- Error handling: > 90%

## 🐛 Debugging

### VS Code Debugging

1. Set breakpoint in test file
2. Run "Debug Test" from test runner
3. Step through code

### Console Debugging

```typescript
it('should debug', async () => {
  const response = await app.inject({ ... });

  console.log('Response:', response.json());
  console.log('Status:', response.statusCode);
});
```

### Verbose Mode

```bash
npm run test -- --reporter=verbose
```

## 📊 CI/CD Integration

### GitHub Actions

```yaml
- name: Run tests
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## 🎓 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#3-testing-best-practices)

---

**Maintained By:** Backend Team
