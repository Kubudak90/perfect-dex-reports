# WebSocket Load Testing

Comprehensive load testing suite for BaseBook DEX WebSocket server.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Ensure server is running
pnpm dev
```

## Quick Start

### Basic Load Test

Test with 100 concurrent clients for 60 seconds:

```bash
node tests/load/websocket-load-test.js
```

### Custom Configuration

```bash
# 1000 clients for 5 minutes
node tests/load/websocket-load-test.js --clients 1000 --duration 300

# Custom WebSocket URL
node tests/load/websocket-load-test.js --url ws://production.basebook.io/ws

# Gradual ramp-up (30 seconds)
node tests/load/websocket-load-test.js --clients 500 --ramp-up 30
```

## Load Test Parameters

| Parameter | Description | Default | Recommended |
|-----------|-------------|---------|-------------|
| `--clients` | Number of concurrent connections | 100 | 100-1000 |
| `--duration` | Test duration in seconds | 60 | 60-300 |
| `--url` | WebSocket endpoint | ws://localhost:3000/ws | - |
| `--ramp-up` | Ramp-up time in seconds | 10 | 10-60 |

## Test Scenarios

### 1. Light Load (Development)

```bash
node tests/load/websocket-load-test.js \
  --clients 50 \
  --duration 30
```

**Expected Results:**
- Connection success rate: >99%
- Error rate: <1%
- Average latency: <50ms
- P95 latency: <100ms

### 2. Medium Load (Staging)

```bash
node tests/load/websocket-load-test.js \
  --clients 500 \
  --duration 120 \
  --ramp-up 20
```

**Expected Results:**
- Connection success rate: >98%
- Error rate: <2%
- Average latency: <100ms
- P95 latency: <200ms

### 3. Heavy Load (Production Simulation)

```bash
node tests/load/websocket-load-test.js \
  --clients 2000 \
  --duration 300 \
  --ramp-up 60
```

**Expected Results:**
- Connection success rate: >95%
- Error rate: <5%
- Average latency: <150ms
- P95 latency: <300ms

### 4. Stress Test (Breaking Point)

```bash
node tests/load/websocket-load-test.js \
  --clients 5000 \
  --duration 600 \
  --ramp-up 120
```

**Goal:** Find the breaking point and maximum capacity.

## Metrics Collected

### Connection Metrics
- Total clients configured
- Successfully connected clients
- Connection success rate
- Average connection time
- Number of disconnections
- Connection errors

### Message Metrics
- Messages sent (client → server)
- Messages received (server → client)
- Messages per second
- Subscription success rate

### Latency Metrics
- Average latency (ping/pong)
- P50 (median) latency
- P95 latency
- P99 latency

### Error Metrics
- Total errors
- Error rate
- Error types

## Success Criteria

| Metric | Threshold | Status |
|--------|-----------|--------|
| Connection Success Rate | ≥95% | ✅ PASS / ❌ FAIL |
| Error Rate | <5% | ✅ PASS / ❌ FAIL |
| Average Latency | <100ms | ✅ PASS / ❌ FAIL |
| P95 Latency | <200ms | ✅ PASS / ❌ FAIL |

## Example Output

```
╔══════════════════════════════════════════════════════════╗
║       BaseBook WebSocket Load Testing                   ║
╚══════════════════════════════════════════════════════════╝

Configuration:
  • Concurrent Clients: 1000
  • Test Duration: 60s
  • WebSocket URL: ws://localhost:3000/ws
  • Ramp-up Time: 10s

🚀 Starting load test...

📈 Ramping up 1000 clients over 10s...

✅ 998 clients connected
📡 998 subscriptions established

🔄 Running test for 60s...

⏱️  60s | 🟢 998/1000 connected | 📡 998 subscribed | 📨 15234 msgs received | ❌ 2 errors

🛑 Stopping test...

╔══════════════════════════════════════════════════════════╗
║                  TEST RESULTS                            ║
╚══════════════════════════════════════════════════════════╝

📊 Connection Stats:
   • Total Clients: 1000
   • Successfully Connected: 998
   • Subscription Success: 998
   • Avg Connection Time: 45.23ms
   • Disconnections: 2
   • Errors: 2

📨 Message Stats:
   • Messages Sent: 5432
   • Messages Received: 15234
   • Messages/sec: 254.50

⚡ Latency Stats (ping/pong):
   • Average: 67.45ms
   • P50: 65.00ms
   • P95: 120.00ms
   • P99: 145.00ms

⏱️  Test Duration: 60.05s

✅ Success Criteria:
   • Connection Success Rate: 99.80% (✅ PASS)
   • Error Rate: 0.04% (✅ PASS)
   • Avg Latency: 67.45ms (✅ PASS)
   • P95 Latency: 120.00ms (✅ PASS)

🎉 LOAD TEST PASSED! 🎉
```

## Integration Tests

Run integration tests before load testing:

```bash
node tests/integration/websocket.test.js
```

These tests verify:
- ✅ Connection establishment
- ✅ Subscribe/unsubscribe
- ✅ Ping/pong
- ✅ Chain switching
- ✅ Error handling
- ✅ Multiple subscriptions
- ✅ Connection cleanup
- ✅ Concurrent connections

## Performance Tuning

### Server Configuration

**Increase connection limits:**

```javascript
// app.ts
const app = fastify({
  connectionTimeout: 60000,
  keepAliveTimeout: 30000,
  maxRequestsPerSocket: 0,
});
```

**Operating system limits:**

```bash
# Increase file descriptor limit
ulimit -n 10000

# Permanent change (Linux)
echo "* soft nofile 10000" >> /etc/security/limits.conf
echo "* hard nofile 10000" >> /etc/security/limits.conf
```

### Redis Configuration

```bash
# redis.conf
maxclients 10000
tcp-backlog 511
timeout 300
```

### Node.js Configuration

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" node tests/load/websocket-load-test.js
```

## Monitoring During Tests

### Server Metrics

```bash
# Watch logs
tail -f logs/app.log | grep -i websocket

# Monitor connections
watch -n 1 'curl -s http://localhost:3000/health/detailed | jq .websocket'
```

### System Resources

```bash
# CPU and Memory
top -p $(pgrep -f "node.*index.ts")

# Network connections
watch -n 1 'netstat -an | grep :3000 | grep ESTABLISHED | wc -l'

# Open file descriptors
lsof -p $(pgrep -f "node.*index.ts") | wc -l
```

### Redis Monitoring

```bash
# Connected clients
redis-cli CLIENT LIST | wc -l

# Pub/Sub channels
redis-cli PUBSUB CHANNELS

# Memory usage
redis-cli INFO memory
```

## Troubleshooting

### Connection Failures

**Issue:** High connection failure rate

**Solutions:**
- Increase server connection limits
- Check firewall/network settings
- Reduce ramp-up time
- Check server logs for errors

### High Latency

**Issue:** Latency exceeds thresholds

**Solutions:**
- Check network conditions
- Reduce server load
- Optimize Redis performance
- Check CPU/memory usage

### Memory Leaks

**Issue:** Memory usage keeps increasing

**Solutions:**
- Check for client disconnection handling
- Monitor subscription cleanup
- Use heap profiling: `node --inspect`

### Redis Overload

**Issue:** Redis maxclients exceeded

**Solutions:**
- Increase Redis maxclients
- Optimize pub/sub patterns
- Use Redis connection pooling

## CI/CD Integration

### GitHub Actions

```yaml
- name: WebSocket Load Test
  run: |
    npm start &
    sleep 10
    node tests/load/websocket-load-test.js --clients 100 --duration 30
```

### Jenkins

```groovy
stage('Load Test') {
  steps {
    sh 'npm start &'
    sh 'sleep 10'
    sh 'node tests/load/websocket-load-test.js --clients 500 --duration 60'
  }
}
```

## Best Practices

1. **Start Small:** Begin with low client counts and gradually increase
2. **Monitor Resources:** Watch CPU, memory, and network during tests
3. **Baseline First:** Run tests without load to establish baselines
4. **Gradual Ramp-Up:** Use ramp-up to simulate realistic load
5. **Multiple Runs:** Run tests multiple times for consistency
6. **Production-like Environment:** Test on similar hardware/network
7. **Document Results:** Keep records of test results over time

## Support

For issues or questions:
- GitHub Issues: https://github.com/basebook/backend/issues
- Documentation: docs/WEBSOCKET_API.md
