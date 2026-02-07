# BaseBook Router - Troubleshooting Guide

## Overview

This guide covers common issues and their solutions when running the BaseBook DEX Router.

---

## Common Issues

### 1. "No route found" Error

**Symptom:**
```json
{
  "error": "Not Found",
  "message": "No route found from 0x... to 0x..."
}
```

**Possible Causes:**

#### a) Tokens not in pool graph
```bash
# Check if tokens exist in graph
curl http://localhost:3001/health | jq '.graph_stats'

# Look for token_count - if 0, graph not loaded
```

**Solution:**
- Ensure pool data is loaded correctly
- Check RPC connection
- Verify token addresses are correct (use checksummed addresses)

#### b) No liquidity path exists
The tokens may not have a direct or indirect trading path.

**Solution:**
- Check if pools exist between these tokens on-chain
- Try adding intermediate tokens (e.g., WETH, USDC as bridges)
- Increase `max_hops` parameter

#### c) Liquidity too low for amount
Large trades may not have sufficient liquidity.

**Solution:**
- Reduce trade size
- Check liquidity in pools:
  ```bash
  curl "http://localhost:3001/v1/quote?token_in=...&token_out=...&amount_in=1000000"
  # Try with smaller amount
  ```

---

### 2. High Price Impact (>5%)

**Symptom:**
```json
{
  "quote": {
    "price_impact": 8.5,
    ...
  }
}
```

**Possible Causes:**

#### a) Large trade size relative to liquidity
Your trade is too large for available liquidity.

**Solution:**
- **Split the trade**: Use `max_splits=3` parameter
  ```bash
  curl "http://localhost:3001/v1/quote?...&max_splits=3"
  ```
- **Reduce trade size**
- **Wait for more liquidity**: Check pool liquidity trends

#### b) Illiquid pools in route
Route uses low-liquidity pools.

**Solution:**
- The router already optimizes for best price
- Consider alternative tokens (e.g., use USDC instead of smaller stablecoin)
- Check if there's a more liquid pool with different fee tier

---

### 3. Slow Response Times (>100ms)

**Symptom:**
Requests taking longer than expected.

**Possible Causes:**

#### a) Graph not loaded
**Check:**
```bash
curl http://localhost:3001/health | jq '.graph_stats.token_count'
# Should be > 0
```

**Solution:**
- Restart router
- Check RPC endpoint is responding
- Verify DATABASE_URL if using persistent storage

#### b) No cache hits
**Check cache hit rate:**
```bash
curl http://localhost:9090/metrics | grep router_cache_hit_rate
```

**Solution:**
- Cache warming: Make repeated requests
- Increase `CACHE_MAX_ENTRIES`
- Check `CACHE_TTL_SECONDS` is reasonable (15s recommended)

#### c) Complex multi-hop routing
**Diagnosis:**
- Check route in response - how many hops?
- 4-hop routes take longer than single-hop

**Solution:**
- This is expected behavior
- Consider reducing `max_hops` if speed is critical
- Performance is still <20µs for 4-hop (well within target)

#### d) RPC endpoint slow
**Check RPC latency:**
```bash
time curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Solution:**
- Use faster RPC provider (Alchemy, Infura, QuickNode)
- Use local Base node for best performance
- Enable RPC caching

---

### 4. Server Won't Start

**Symptom:**
```
Error: Cannot bind to 0.0.0.0:3001
```

**Possible Causes:**

#### a) Port already in use
**Check:**
```bash
lsof -i :3001
# or
netstat -tuln | grep 3001
```

**Solution:**
- Kill existing process:
  ```bash
  kill $(lsof -t -i:3001)
  ```
- Use different port:
  ```bash
  SERVER_PORT=3002 cargo run
  ```

#### b) Permission denied (port <1024)
**Solution:**
- Use port >1024 (e.g., 3001, 8080)
- Or run with sudo (not recommended)

#### c) Missing environment variables
**Check logs:**
```bash
cargo run 2>&1 | grep "environment"
```

**Solution:**
- Set required env vars:
  ```bash
  export RPC_URL="https://mainnet.base.org"
  export CHAIN_ID=8453
  ```

---

### 5. Invalid Amount Error

**Symptom:**
```json
{
  "error": "Bad Request",
  "message": "Invalid amount"
}
```

**Possible Causes:**

#### a) Amount is zero or negative
**Solution:**
- Ensure `amount_in > 0`
- Use string format for large numbers
  ```bash
  # Correct
  amount_in=1000000000000000000

  # Incorrect
  amount_in=0
  ```

#### b) Amount too large (overflow)
**Solution:**
- Check amount doesn't exceed `u128::MAX`
- Use reasonable amounts (max: ~10^38)

#### c) Invalid format
**Solution:**
- Use decimal string, no scientific notation
- No commas or separators
  ```bash
  # Correct
  amount_in=1000000000000000000

  # Incorrect
  amount_in=1e18
  amount_in=1,000,000,000,000,000,000
  ```

---

### 6. CORS Errors (Frontend)

**Symptom:**
```
Access to fetch at 'http://localhost:3001/v1/quote' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solution:**

#### For Development:
```bash
# Set allowed origins
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
cargo run
```

#### For Production:
Configure Nginx to handle CORS:
```nginx
add_header Access-Control-Allow-Origin "https://basebook.fi" always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type" always;
```

Or set in router:
```bash
export CORS_ALLOWED_ORIGINS="https://basebook.fi,https://app.basebook.fi"
```

---

### 7. Out of Memory

**Symptom:**
```
thread 'main' panicked at 'allocation failed'
```

**Possible Causes:**

#### a) Cache too large
**Check memory usage:**
```bash
ps aux | grep routing-engine
# Or Docker:
docker stats basebook-router
```

**Solution:**
- Reduce `CACHE_MAX_ENTRIES`
  ```bash
  export CACHE_MAX_ENTRIES=5000  # Default: 10000
  ```
- Increase container memory limit:
  ```yaml
  resources:
    limits:
      memory: "2Gi"  # Increase from 512Mi
  ```

#### b) Large pool graph
**Solution:**
- Expected: ~1MB per 1000 tokens
- 10K tokens = ~10MB (acceptable)
- If much higher, investigate memory leak

---

### 8. High CPU Usage

**Symptom:**
CPU usage constantly at 100%

**Possible Causes:**

#### a) High request rate
**Check:**
```bash
curl http://localhost:9090/metrics | grep router_requests_total
```

**Solution:**
- Scale horizontally (add more instances)
- Enable rate limiting
- Check for request loops

#### b) No caching
**Check cache hit rate:**
```bash
curl http://localhost:9090/metrics | grep router_cache_hit_rate
```

**Solution:**
- Should be >50%
- If low, check cache configuration
- Increase cache size

#### c) Infinite loop in routing
**Diagnosis:**
- Check logs for stuck requests
- Look for repeated "calculating route" messages

**Solution:**
- Restart router
- Report bug with request parameters

---

### 9. WebSocket Connection Fails

**Symptom:**
```
WebSocket connection to 'ws://localhost:3001/ws' failed
```

**Possible Causes:**

#### a) WebSocket not enabled
**Solution:**
- Check if router has WebSocket support compiled in
- Verify correct endpoint (`/ws` or `/websocket`)

#### b) Nginx not configured for WebSocket
**Solution:**
- Add to nginx config:
  ```nginx
  location /ws {
      proxy_pass http://router_backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
  }
  ```

---

### 10. Docker Container Keeps Restarting

**Symptom:**
```bash
docker ps -a
# STATUS: Restarting (1) 10 seconds ago
```

**Diagnosis:**
```bash
docker logs basebook-router
```

**Common Causes & Solutions:**

#### a) Missing environment variables
**Solution:**
- Check `docker-compose.yml` has all required env vars
- Verify `.env` file exists and is loaded

#### b) Health check failing
**Solution:**
- Test health endpoint manually:
  ```bash
  docker exec basebook-router curl http://localhost:3001/health
  ```
- Adjust health check timing in compose file
- Check application logs for startup errors

#### c) Port conflict
**Solution:**
- Check if port 3001 is available on host
- Change port mapping:
  ```yaml
  ports:
    - "3002:3001"  # External:Internal
  ```

---

## Debugging Tools

### 1. Enable Debug Logging

```bash
RUST_LOG=debug cargo run

# Or for specific module
RUST_LOG=routing_engine::routing=debug cargo run
```

### 2. Check Health Endpoint

```bash
# Basic health check
curl http://localhost:3001/health

# Pretty print with jq
curl -s http://localhost:3001/health | jq '.'

# Watch continuously
watch -n 1 'curl -s http://localhost:3001/health | jq'
```

### 3. Monitor Metrics

```bash
# All metrics
curl http://localhost:9090/metrics

# Specific metric
curl http://localhost:9090/metrics | grep router_quote_duration

# Cache stats
curl http://localhost:9090/metrics | grep cache
```

### 4. Test Quote Generation

```bash
# Minimal test
curl "http://localhost:3001/v1/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount_in=1000000000000000000"

# With verbose output
curl -v "http://localhost:3001/v1/quote?..."

# Time the request
time curl "http://localhost:3001/v1/quote?..."

# Pretty print response
curl "http://localhost:3001/v1/quote?..." | jq '.'
```

### 5. Load Testing

```bash
# Simple load test with Apache Bench
ab -n 1000 -c 10 "http://localhost:3001/v1/quote?token_in=...&token_out=...&amount_in=1000000000000000000"

# Or use k6
k6 run load-test.js
```

### 6. Memory Profiling

```bash
# Install valgrind
sudo apt-get install valgrind

# Run with memcheck
valgrind --leak-check=full --show-leak-kinds=all ./target/release/routing-engine

# Or use heaptrack
heaptrack ./target/release/routing-engine
heaptrack_gui heaptrack.routing-engine.*.gz
```

---

## Performance Issues

### Latency Optimization

**If quote generation is slow:**

1. **Check cache hit rate** (target: >70%)
   ```bash
   curl http://localhost:9090/metrics | grep router_cache_hit_rate
   ```

2. **Profile with flamegraph**
   ```bash
   cargo install flamegraph
   cargo flamegraph --bin routing-engine
   ```

3. **Enable parallel routing**
   - Already enabled for routes with >2 hops
   - Check `WORKER_THREADS` env var

4. **Optimize RPC calls**
   - Use multicall for batch queries
   - Increase RPC rate limits
   - Consider local node

### Memory Optimization

**If memory usage is high:**

1. **Check cache size**
   ```bash
   # Expected: ~650 bytes per cached route
   # 10K routes = ~6.5MB
   ```

2. **Reduce cache entries**
   ```bash
   export CACHE_MAX_ENTRIES=5000
   ```

3. **Check for memory leaks**
   ```bash
   # Monitor over time
   watch -n 10 'docker stats basebook-router --no-stream'
   ```

---

## Error Codes Reference

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters |
| 404 | Not Found | No route found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Router unreachable |
| 503 | Service Unavailable | Router overloaded |

### Application Error Codes

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "code": "ERROR_CODE"
}
```

| Error Code | Description | Solution |
|------------|-------------|----------|
| `INVALID_AMOUNT` | Amount is 0, negative, or invalid format | Check amount format |
| `INVALID_ADDRESS` | Token address is invalid | Verify address checksum |
| `NO_ROUTE` | No trading path found | Check tokens and liquidity |
| `INSUFFICIENT_LIQUIDITY` | Not enough liquidity for amount | Reduce amount or split |
| `PRICE_IMPACT_TOO_HIGH` | Price impact >50% | Reduce amount significantly |
| `GRAPH_NOT_LOADED` | Pool graph not initialized | Wait for startup or restart |
| `RPC_ERROR` | RPC endpoint error | Check RPC_URL and connectivity |

---

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Check [README.md](./README.md) documentation
3. ✅ Check router logs for error messages
4. ✅ Check health endpoint status
5. ✅ Try with minimal test case

### Where to Get Help

1. **GitHub Issues**: [basebook/dex/issues](https://github.com/basebook/dex/issues)
   - Search existing issues first
   - Include: error logs, request parameters, environment info

2. **Discord**: [BaseBook Community](https://discord.gg/basebook)
   - #dev-help channel for technical questions
   - #bugs for bug reports

3. **Stack Overflow**: Tag `basebook-dex`

### Bug Report Template

```markdown
**Environment:**
- OS: [e.g., Ubuntu 22.04, macOS 14.1]
- Deployment: [Docker, Kubernetes, Bare metal]
- Router version: [e.g., 0.1.0]
- Rust version: [e.g., 1.75.0]

**Describe the bug:**
A clear description of what went wrong.

**To Reproduce:**
1. Start router with `...`
2. Make request `curl "http://localhost:3001/v1/quote?..."`
3. See error

**Expected behavior:**
What you expected to happen.

**Logs:**
```
[Include relevant logs here]
```

**Request Parameters:**
```json
{
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in": "...",
  ...
}
```

**Additional context:**
Any other relevant information.
```

---

## Emergency Procedures

### Service Down

1. **Check health endpoint**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check logs**
   ```bash
   docker logs basebook-router --tail=100
   # or
   kubectl logs deployment/basebook-router -n basebook --tail=100
   ```

3. **Restart service**
   ```bash
   # Docker
   docker-compose restart router

   # Kubernetes
   kubectl rollout restart deployment/basebook-router -n basebook
   ```

4. **If still down, rollback**
   ```bash
   kubectl rollout undo deployment/basebook-router -n basebook
   ```

### Data Corruption

1. **Clear cache**
   ```bash
   # Redis
   redis-cli FLUSHDB

   # Or restart with clean state
   docker-compose down -v && docker-compose up -d
   ```

2. **Reload graph data**
   - Restart router to reload from RPC
   - Or restore from database backup

### High Load

1. **Enable rate limiting**
   ```nginx
   limit_req zone=router_limit burst=20 nodelay;
   ```

2. **Scale horizontally**
   ```bash
   kubectl scale deployment basebook-router --replicas=10 -n basebook
   ```

3. **Add more cache**
   ```bash
   export CACHE_MAX_ENTRIES=50000
   ```

---

## FAQ

**Q: How long should quotes be cached?**
A: 15 seconds (default). Blockchain state changes ~every 2 seconds, but route quality doesn't change that quickly.

**Q: Why is my cache hit rate low?**
A: Could be:
- Amounts are too varied (enable amount bucketing)
- TTL too short
- High slippage variations
- Not enough traffic

**Q: Can I run router without RPC?**
A: No, router needs RPC to fetch pool states. But you can cache aggressively to reduce RPC calls.

**Q: How do I update pool data?**
A: Pool data is fetched on-demand from RPC. To force update, restart router or implement webhook from indexer.

**Q: What's the maximum trade size?**
A: Limited by pool liquidity, not by router. Router supports up to `u128::MAX` (~3.4×10^38).

**Q: Can I run multiple routers?**
A: Yes! They're stateless. Use load balancer to distribute requests.

**Q: How do I backup router data?**
A: Router is stateless. Only need to backup configuration (environment variables).

---

## Performance Benchmarks

Expected performance on standard hardware (4 CPU cores, 8GB RAM):

- **Single-hop**: 190ns (0.00019ms)
- **2-hop**: 2.7µs (0.0027ms)
- **3-hop**: 9.7µs (0.0097ms)
- **4-hop**: 18.9µs (0.019ms)
- **Cache hit**: 672ns (0.00067ms)

If your numbers are significantly worse, check:
1. CPU throttling
2. Memory pressure
3. RPC latency
4. Disk I/O (if using persistent storage)

---

**Still having issues? [Open a GitHub issue](https://github.com/basebook/dex/issues/new) with details.**
