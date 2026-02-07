# 🔶 Mock Mode - API Without Database

Backend API can now run in **Mock Mode** without PostgreSQL or Redis!

## 🎯 Purpose

Mock mode allows:
- ✅ API development without database setup
- ✅ Quick testing and debugging
- ✅ CI/CD pipeline testing
- ✅ Frontend development with backend API
- ✅ Demo and presentation mode

## 🚀 Quick Start

### Enable Mock Mode

```bash
cd backend

# Set environment variable
export MOCK_MODE=true

# Or edit .env file
echo "MOCK_MODE=true" >> .env

# Start server
npm run dev
```

Server starts at: **http://localhost:3000**

No PostgreSQL or Redis required! 🎉

---

## 📊 What Works in Mock Mode

### ✅ Fully Functional

- **Health Checks**
  - `GET /health` - Basic health
  - `GET /health/detailed` - Shows "mock" status

- **API Routes**
  - All 25 endpoints registered
  - Request validation works
  - Error handling works

- **WebSocket**
  - Connection works
  - Message handling works
  - Pub/sub simulated in-memory

- **Rate Limiting**
  - In-memory rate limiting
  - All tiers work

### ⚠️ Mock Data

In mock mode, endpoints return:
- **Empty arrays** for list endpoints
- **Mock responses** for detail endpoints
- **Success responses** for mutations

### ❌ Not Available

- Real database queries
- Persistent data storage
- Redis caching (uses in-memory)
- Database migrations
- Seed data

---

## 🔧 Configuration

### Environment Variable

```env
# .env file
MOCK_MODE=true
```

### Programmatic Check

```typescript
import { isMockMode } from './config/mock';

if (isMockMode()) {
  console.log('Running in mock mode');
}
```

---

## 📝 Implementation Details

### Mock Database Client

```typescript
class MockDB {
  async query() {
    return { rows: [] };
  }

  select() {
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    };
  }

  // ... other methods
}
```

### Mock Redis Client

```typescript
class MockRedis {
  private storage = new Map();

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.storage.set(key, value);
    return 'OK';
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  // ... other methods
}
```

---

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3000/health

# Response:
{
  "status": "healthy",
  "timestamp": 1234567890,
  "mode": "mock"
}
```

### Detailed Health

```bash
curl http://localhost:3000/health/detailed

# Response:
{
  "status": "healthy",
  "mode": "mock",
  "uptime": 123.45,
  "dependencies": {
    "database": { "status": "mock" },
    "redis": { "status": "mock" }
  }
}
```

### API Endpoints

```bash
# Tokens (empty in mock mode)
curl http://localhost:3000/v1/tokens?chainId=84532

# Pools (empty in mock mode)
curl http://localhost:3000/v1/pools?chainId=84532

# Oracle prices (mock data)
curl http://localhost:3000/v1/oracle/prices?chainId=84532
```

---

## 🔄 Switching Between Modes

### Development with Database

```env
MOCK_MODE=false
DATABASE_URL=postgresql://basebook:basebook@localhost:5432/basebook_dev
REDIS_URL=redis://localhost:6379
```

```bash
docker-compose up -d postgres redis
npm run db:push
npm run db:seed
npm run dev
```

### Development without Database (Mock)

```env
MOCK_MODE=true
# DATABASE_URL not required
# REDIS_URL not required
```

```bash
npm run dev
```

---

## 📊 Use Cases

### 1. Frontend Development

Frontend developers can start immediately:

```bash
# Backend (mock mode)
cd backend
MOCK_MODE=true npm run dev

# Frontend
cd frontend
npm run dev
```

Frontend can connect to API and test UI without database.

### 2. CI/CD Testing

```yaml
# .github/workflows/test.yml
- name: Test API
  env:
    MOCK_MODE: true
  run: |
    npm run dev &
    sleep 5
    npm run test:api
```

### 3. Demo Mode

```bash
# Quick demo without setup
MOCK_MODE=true npm run dev
```

---

## ⚠️ Limitations

### Mock Mode Should NOT Be Used For:

- ❌ Production deployment
- ❌ Performance testing
- ❌ Data persistence testing
- ❌ Database query testing
- ❌ Real user data

### Mock Mode IS Good For:

- ✅ API structure testing
- ✅ Frontend development
- ✅ CI/CD pipeline
- ✅ Quick demos
- ✅ Development without infrastructure

---

## 🔄 Transitioning to Production Mode

When ready to use real database:

1. **Start PostgreSQL & Redis**
   ```bash
   docker-compose up -d postgres redis
   ```

2. **Disable Mock Mode**
   ```env
   MOCK_MODE=false
   ```

3. **Run Migrations**
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Restart Server**
   ```bash
   npm run dev
   ```

---

## 📝 Adding Mock Data

To add mock responses for specific endpoints, edit handlers:

```typescript
import { isMockMode } from '../../config/mock';

export async function getTokensHandler(request, reply) {
  if (isMockMode()) {
    // Return mock data
    return reply.send({
      success: true,
      data: {
        tokens: [
          {
            address: '0x...',
            symbol: 'MOCK',
            name: 'Mock Token',
            // ... mock data
          }
        ]
      }
    });
  }

  // Real database query
  const tokens = await request.server.db.select()...;
  return reply.send({ success: true, data: { tokens } });
}
```

---

## ✅ Status

**Mock Mode:** ✅ Fully Implemented

**Features:**
- ✅ Mock database client
- ✅ Mock Redis client
- ✅ Environment variable
- ✅ Health check integration
- ✅ Graceful fallback

**Next Steps:**
- [ ] Add mock data for common queries
- [ ] Add mock response fixtures
- [ ] Document all mock endpoints

---

**Last Updated:** 2026-02-04
**Status:** ✅ Ready to Use
