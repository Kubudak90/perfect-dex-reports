# BaseBook DEX - Monitoring Stack

Comprehensive monitoring, alerting, and observability for BaseBook DEX using Prometheus, Grafana, and Alertmanager.

## Table of Contents
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Metrics](#metrics)
- [Alerts](#alerts)
- [Dashboards](#dashboards)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│   Backend API │ Router │ Frontend │ PostgreSQL │ Redis      │
│   (metrics endpoints on /metrics)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ scrape
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Prometheus                              │
│   • Scrapes metrics every 15s                               │
│   • Evaluates alert rules                                   │
│   • Stores time-series data (30 days)                       │
└───────────┬─────────────────────┬───────────────────────────┘
            │                     │
            │ query               │ alerts
            ▼                     ▼
┌───────────────────┐   ┌───────────────────┐
│     Grafana       │   │   Alertmanager    │
│   Dashboards      │   │   • Routes alerts │
│   Visualizations  │   │   • Groups alerts │
└───────────────────┘   │   • Notifies      │
                        └─────────┬─────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
            Slack          PagerDuty          Webhook
```

## Quick Start

### Docker Compose (Local Development)

```bash
# Start main services
docker-compose up -d

# Start monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access services
# Grafana:      http://localhost:3001 (admin/admin)
# Prometheus:   http://localhost:9090
# Alertmanager: http://localhost:9093
```

### Kubernetes

```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus-deployment.yaml

# Deploy Grafana
kubectl apply -f k8s/monitoring/grafana-deployment.yaml

# Deploy Alertmanager
kubectl apply -f k8s/monitoring/alertmanager-deployment.yaml
```

## Metrics

### Backend API Metrics

**Endpoint**: `http://backend:4000/metrics`

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by endpoint, method, status |
| `http_request_duration_seconds` | Histogram | Request duration in seconds |
| `http_request_size_bytes` | Histogram | Request size in bytes |
| `http_response_size_bytes` | Histogram | Response size in bytes |
| `swap_attempts_total` | Counter | Total swap attempts |
| `swap_successes_total` | Counter | Successful swaps |
| `swap_failures_total` | Counter | Failed swaps |
| `swap_duration_seconds` | Histogram | Swap execution duration |
| `swap_volume_usd_total` | Counter | Total swap volume in USD |
| `swap_fees_collected_usd_total` | Counter | Total fees collected |
| `pool_tvl_usd` | Gauge | Total Value Locked per pool |
| `liquidity_positions_total` | Gauge | Number of liquidity positions |
| `active_users_total` | Gauge | Number of active users |

### Router Metrics

**Endpoint**: `http://router:8080/metrics`

| Metric | Type | Description |
|--------|------|-------------|
| `route_calculations_total` | Counter | Total route calculations |
| `route_calculations_failed_total` | Counter | Failed route calculations |
| `routes_not_found_total` | Counter | Routes not found |
| `route_calculation_duration_seconds` | Histogram | Route calculation duration |
| `route_cache_hits_total` | Counter | Cache hits |
| `route_cache_misses_total` | Counter | Cache misses |
| `route_cache_requests_total` | Counter | Total cache requests |
| `route_cache_evictions_total` | Counter | Cache evictions |
| `pool_graph_nodes_total` | Gauge | Number of nodes in pool graph |
| `pool_graph_edges_total` | Gauge | Number of edges in pool graph |
| `pool_graph_last_update_timestamp` | Gauge | Last pool graph update timestamp |

### Database Metrics

**Endpoint**: `http://postgres-exporter:9187/metrics`

Provided by `postgres_exporter`:
- Connection pool stats
- Query performance
- Transaction rates
- Deadlocks
- Table/index sizes
- Replication lag

### Redis Metrics

**Endpoint**: `http://redis-exporter:9121/metrics`

Provided by `redis_exporter`:
- Memory usage
- Hit/miss rates
- Evictions
- Command statistics
- Key count

## Alerts

### Alert Rules

Located in `monitoring/prometheus/rules/`:

1. **api-alerts.yml** - API-specific alerts
   - HighErrorRate (>5% for 5m)
   - HighLatency (P95 >1s for 5m)
   - NoTraffic (0 requests for 10m)
   - SlowEndpoint (P99 >5s for 10m)
   - HighSwapFailureRate (>2% for 5m)

2. **router-alerts.yml** - Router-specific alerts
   - SlowRouteCalculation (P95 >500ms for 5m)
   - HighRouteFailureRate (>5% for 5m)
   - NoRoutesFound (>20% for 10m)
   - RouterHighCPU (>80% for 10m)
   - PoolGraphOutdated (>5m old)

3. **infrastructure-alerts.yml** - Infrastructure alerts
   - ServiceDown (down for 1m)
   - PodCrashLooping (continuous restarts)
   - ContainerHighMemory (>80% for 10m)
   - DatabaseDown (down for 1m)
   - RedisDown (down for 1m)
   - DiskSpaceLow (<20% for 5m)

4. **recording-rules.yml** - Pre-computed metrics
   - Request rates per job/endpoint
   - Latency percentiles
   - Error rates
   - Resource usage ratios

### Alert Severity Levels

- **critical**: Immediate action required, service impact
- **warning**: Investigate soon, potential issues
- **info**: Informational, no immediate action

### Alert Routing

Alertmanager routes alerts based on labels:

| Label | Receiver | Description |
|-------|----------|-------------|
| `page: true` | PagerDuty | Wake up on-call |
| `severity: critical` | Slack + Webhook | Multiple channels |
| `component: backend` | #backend-alerts | Backend team |
| `component: router` | #router-alerts | Router team |
| `alertname: Service*` | #infrastructure-alerts | Infra team |

### Configuring Alertmanager

Edit `monitoring/alertmanager/alertmanager.yml`:

```yaml
# Set Slack webhook
global:
  slack_api_url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Set PagerDuty key
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-service-key'
```

Or use environment variables:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
export PAGERDUTY_SERVICE_KEY="your-key"
```

## Dashboards

### Available Dashboards

Located in `monitoring/grafana/dashboards/`:

1. **overview-dashboard.json** - System overview
   - Service health status
   - Request rates
   - Error rates
   - Swap metrics
   - Business metrics (TVL, volume, users)

2. **router-dashboard.json** - Router performance
   - Route calculation rates
   - Calculation duration (P50, P95, P99)
   - Cache hit rates
   - Pool graph statistics
   - Resource usage

3. **api-dashboard.json** - API performance
   - Endpoint request rates
   - Response times by endpoint
   - Error rates by endpoint
   - Top slowest endpoints

4. **infrastructure-dashboard.json** - Infrastructure
   - Pod resource usage
   - Database metrics
   - Redis metrics
   - Network traffic

### Importing Dashboards

#### Via Grafana UI

1. Go to Dashboards → Import
2. Upload JSON file or paste JSON
3. Select Prometheus datasource
4. Click Import

#### Via Provisioning

Dashboards in `monitoring/grafana/dashboards/` are automatically provisioned if:

```yaml
# monitoring/grafana/dashboards/dashboard-config.yml
apiVersion: 1
providers:
  - name: 'BaseBook DEX'
    orgId: 1
    folder: 'BaseBook'
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
```

### Creating Custom Dashboards

1. Create in Grafana UI
2. Export JSON via Share → Export
3. Save to `monitoring/grafana/dashboards/`
4. Commit to version control

## Configuration

### Prometheus Configuration

**File**: `monitoring/prometheus.yml`

Key settings:

```yaml
global:
  scrape_interval: 15s        # How often to scrape
  evaluation_interval: 15s    # How often to evaluate rules

scrape_configs:
  - job_name: 'backend-api'
    scrape_interval: 10s      # Override per job
    static_configs:
      - targets: ['backend:4000']
```

### Recording Rules

Pre-compute expensive queries:

```yaml
# monitoring/prometheus/rules/recording-rules.yml
- record: job:http_requests:rate5m
  expr: sum(rate(http_requests_total[5m])) by (job)
```

Use in queries: `job:http_requests:rate5m` instead of full expression.

### Data Retention

Default: 30 days

Change in Prometheus args:

```yaml
args:
  - '--storage.tsdb.retention.time=90d'  # 90 days
  - '--storage.tsdb.retention.size=50GB' # or by size
```

## Troubleshooting

### No Metrics Showing

**Symptoms**: Empty graphs, "No data" in Grafana

**Checks**:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check if metrics endpoint is accessible
curl http://backend:4000/metrics
curl http://router:8080/metrics

# Check Prometheus logs
docker logs basebook-prometheus
kubectl logs -n monitoring deployment/prometheus
```

**Solutions**:
- Verify service is running and healthy
- Check network connectivity
- Verify metrics port is correct
- Check Prometheus scrape config

### Alerts Not Firing

**Symptoms**: Expected alerts not showing in Alertmanager

**Checks**:
```bash
# Check alert rules loaded
curl http://localhost:9090/api/v1/rules

# Check active alerts
curl http://localhost:9090/api/v1/alerts

# Evaluate expression manually
curl 'http://localhost:9090/api/v1/query?query=up'
```

**Solutions**:
- Verify rule syntax
- Check `for` duration (alert may be pending)
- Verify expression evaluates to >0
- Check Prometheus logs for rule errors

### Alerts Firing but No Notifications

**Symptoms**: Alerts in Alertmanager but no Slack/PagerDuty

**Checks**:
```bash
# Check Alertmanager status
curl http://localhost:9093/api/v2/status

# Check alert receivers
curl http://localhost:9093/api/v2/receivers

# Check Alertmanager logs
docker logs basebook-alertmanager
```

**Solutions**:
- Verify webhook URLs and keys
- Check routing rules match alert labels
- Test webhook manually with curl
- Verify network access to external services

### High Cardinality Issues

**Symptoms**: Prometheus high memory usage, slow queries

**Checks**:
```bash
# Check series count
curl http://localhost:9090/api/v1/status/tsdb

# Find high-cardinality metrics
curl 'http://localhost:9090/api/v1/label/__name__/values'
```

**Solutions**:
- Avoid user IDs or unique values as labels
- Use recording rules for complex queries
- Increase Prometheus memory limits
- Reduce retention time

### Grafana Dashboard Issues

**Symptoms**: Dashboard errors, empty panels

**Checks**:
- Check datasource connection in Grafana
- Verify Prometheus URL is correct
- Test query in Prometheus UI first
- Check time range (data may not exist)

**Solutions**:
- Fix datasource configuration
- Adjust time range
- Simplify complex queries
- Use recording rules for expensive queries

## Best Practices

### Metric Naming

Follow Prometheus conventions:

```
# Good
http_requests_total
route_calculation_duration_seconds
pool_tvl_usd

# Bad
httpRequests
routeTime
PoolTVL
```

### Label Usage

```yaml
# Good - bounded cardinality
http_requests_total{endpoint="/swap", method="POST", status="200"}

# Bad - unbounded cardinality
http_requests_total{user_id="12345", tx_hash="0x..."}
```

### Alert Thresholds

- Set thresholds based on SLIs/SLOs
- Use historical data to tune
- Add `for` duration to avoid flapping
- Test alerts in staging first

### Dashboard Design

- Start with high-level overview
- Drill down to details
- Use consistent colors/themes
- Add panel descriptions
- Link to runbooks

## Advanced Topics

### Custom Metrics

Add to your application:

```typescript
// TypeScript example
import { Counter, Histogram } from 'prom-client';

const swapCounter = new Counter({
  name: 'swap_attempts_total',
  help: 'Total swap attempts',
  labelNames: ['status']
});

const swapDuration = new Histogram({
  name: 'swap_duration_seconds',
  help: 'Swap duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Instrument code
swapCounter.inc({ status: 'success' });
swapDuration.observe(duration);
```

### Federation

Aggregate metrics from multiple Prometheus instances:

```yaml
# In central Prometheus
scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job="backend-api"}'
    static_configs:
      - targets:
        - 'prometheus-region1:9090'
        - 'prometheus-region2:9090'
```

### Long-term Storage

Use Thanos or Cortex for:
- Unlimited retention
- Multi-cluster aggregation
- High availability
- Cost-effective storage (S3, GCS)

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Metric Naming Best Practices](https://prometheus.io/docs/practices/naming/)

---

**Maintained by**: QA/DevOps Team
**Last Updated**: 2024-02-03
