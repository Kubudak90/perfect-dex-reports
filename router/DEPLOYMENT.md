# BaseBook Router - Production Deployment Guide

## Overview

This guide covers deploying the BaseBook DEX Router to production environments.

## Prerequisites

- Docker & Docker Compose
- Kubernetes cluster (optional, for scaling)
- SSL certificate for HTTPS
- Base RPC endpoint (e.g., Alchemy, Infura)
- PostgreSQL database (for pool data caching)
- Redis instance (for route caching)

---

## Environment Configuration

### Required Environment Variables

```bash
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=3001

# Chain Configuration
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org
# Alternative: Use Alchemy or Infura for better reliability
# RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Routing Configuration
MAX_HOPS=4
MAX_SPLITS=3
DEFAULT_SLIPPAGE=0.5

# Cache Configuration
CACHE_TTL_SECONDS=15
CACHE_MAX_ENTRIES=10000

# Performance
RUST_LOG=info
WORKER_THREADS=8  # Set to CPU core count

# Monitoring (optional)
METRICS_ENABLED=true
METRICS_PORT=9090
```

### Optional Environment Variables

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# CORS
CORS_ALLOWED_ORIGINS=https://basebook.fi,https://app.basebook.fi

# Database (for pool data persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/basebook

# Redis (for distributed caching)
REDIS_URL=redis://localhost:6379

# Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn
```

---

## Docker Deployment

### 1. Build Docker Image

```bash
# Clone repository
git clone https://github.com/basebook/dex.git
cd dex/router

# Build production image
docker build -t basebook-router:latest -f Dockerfile.prod .
```

### 2. Run with Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  router:
    image: basebook-router:latest
    container_name: basebook-router
    restart: unless-stopped
    ports:
      - "3001:3001"
      - "9090:9090"  # Metrics port
    environment:
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=3001
      - CHAIN_ID=8453
      - RPC_URL=${RPC_URL}
      - MAX_HOPS=4
      - MAX_SPLITS=3
      - RUST_LOG=info
      - METRICS_ENABLED=true
      - METRICS_PORT=9090
    volumes:
      - ./config:/app/config:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - basebook-network

  redis:
    image: redis:7-alpine
    container_name: basebook-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - basebook-network

  nginx:
    image: nginx:alpine
    container_name: basebook-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - router
    networks:
      - basebook-network

volumes:
  redis-data:

networks:
  basebook-network:
    driver: bridge
```

### 3. Start Services

```bash
# Export environment variables
export RPC_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f router

# Verify health
curl http://localhost:3001/health
```

---

## Kubernetes Deployment

### 1. Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: basebook
```

### 2. Create ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: router-config
  namespace: basebook
data:
  SERVER_HOST: "0.0.0.0"
  SERVER_PORT: "3001"
  CHAIN_ID: "8453"
  MAX_HOPS: "4"
  MAX_SPLITS: "3"
  RUST_LOG: "info"
  METRICS_ENABLED: "true"
  METRICS_PORT: "9090"
```

### 3. Create Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: router-secret
  namespace: basebook
type: Opaque
stringData:
  RPC_URL: "https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
```

### 4. Create Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basebook-router
  namespace: basebook
spec:
  replicas: 3
  selector:
    matchLabels:
      app: basebook-router
  template:
    metadata:
      labels:
        app: basebook-router
    spec:
      containers:
      - name: router
        image: basebook-router:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: http
        - containerPort: 9090
          name: metrics
        envFrom:
        - configMapRef:
            name: router-config
        - secretRef:
            name: router-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### 5. Create Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: basebook-router
  namespace: basebook
spec:
  type: ClusterIP
  selector:
    app: basebook-router
  ports:
  - name: http
    port: 80
    targetPort: 3001
  - name: metrics
    port: 9090
    targetPort: 9090
```

### 6. Create Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basebook-router
  namespace: basebook
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "60"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - router.basebook.fi
    secretName: router-tls
  rules:
  - host: router.basebook.fi
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: basebook-router
            port:
              number: 80
```

### 7. Apply Configuration

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n basebook
kubectl logs -f deployment/basebook-router -n basebook
```

---

## Nginx Configuration

### nginx.conf

```nginx
events {
    worker_connections 4096;
}

http {
    upstream router_backend {
        least_conn;
        server router:3001 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=router_limit:10m rate=60r/m;

    server {
        listen 80;
        server_name router.basebook.fi;

        # Redirect to HTTPS
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name router.basebook.fi;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # CORS
        add_header Access-Control-Allow-Origin "https://basebook.fi" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        location / {
            limit_req zone=router_limit burst=20 nodelay;

            proxy_pass http://router_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 10s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Health check endpoint (bypass rate limiting)
        location /health {
            proxy_pass http://router_backend;
            access_log off;
        }

        # Metrics endpoint (restrict access)
        location /metrics {
            allow 10.0.0.0/8;  # Internal network only
            deny all;
            proxy_pass http://router_backend:9090;
        }
    }
}
```

---

## Monitoring & Observability

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'basebook-router'
    scrape_interval: 15s
    static_configs:
      - targets: ['router:9090']
    metrics_path: /metrics
```

### Grafana Dashboard

Key metrics to monitor:

1. **Latency Metrics**
   - `router_quote_duration_seconds` - Quote generation time
   - `router_route_duration_seconds` - Route calculation time

2. **Cache Metrics**
   - `router_cache_hits_total` - Cache hit count
   - `router_cache_misses_total` - Cache miss count
   - `router_cache_hit_rate` - Hit rate percentage

3. **Request Metrics**
   - `router_requests_total` - Total requests
   - `router_errors_total` - Error count
   - `router_active_requests` - Concurrent requests

4. **System Metrics**
   - `process_cpu_seconds_total` - CPU usage
   - `process_resident_memory_bytes` - Memory usage

### Alerts

```yaml
# alerts.yml
groups:
  - name: router_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(router_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"

      - alert: SlowQuotes
        expr: histogram_quantile(0.95, router_quote_duration_seconds) > 0.01
        for: 5m
        annotations:
          summary: "Slow quote generation"
          description: "P95 latency is {{ $value }} seconds"

      - alert: LowCacheHitRate
        expr: router_cache_hit_rate < 0.5
        for: 10m
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}"
```

---

## Scaling Strategy

### Horizontal Scaling

The router is stateless and can be scaled horizontally:

```bash
# Kubernetes
kubectl scale deployment basebook-router --replicas=5 -n basebook

# Docker Compose
docker-compose -f docker-compose.prod.yml up -d --scale router=5
```

### Load Balancing

Use Nginx or cloud load balancer:
- **Algorithm**: Least connections (for better cache utilization)
- **Health checks**: `/health` endpoint
- **Session affinity**: Not required (stateless)

### Auto-scaling (Kubernetes)

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: basebook-router
  namespace: basebook
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: basebook-router
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Security Best Practices

### 1. Rate Limiting

Implement at multiple levels:
- **Nginx**: 60 requests/minute per IP
- **Application**: Configurable via env vars
- **CloudFlare**: DDoS protection

### 2. API Authentication (Optional)

For private deployments:

```rust
// Add API key middleware
async fn api_key_middleware(
    req: Request<Body>,
    next: Next<Body>,
) -> Result<Response, StatusCode> {
    let api_key = req.headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok());

    if api_key != Some(env::var("API_KEY").unwrap()) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(req).await)
}
```

### 3. Input Validation

All inputs are validated:
- Token addresses (checksum validation)
- Amounts (positive, non-zero)
- Slippage (0-100%)
- Hops/splits (within limits)

### 4. HTTPS Only

Always use HTTPS in production:
- SSL/TLS certificates (Let's Encrypt)
- HTTP → HTTPS redirect
- HSTS header

---

## Backup & Recovery

### Data to Backup

1. **Pool Graph Data**: Backed up to PostgreSQL
2. **Configuration**: In Git repository
3. **Logs**: Shipped to centralized logging

### Disaster Recovery

1. **Database Recovery**: Restore from PostgreSQL backup
2. **Service Recovery**:
   ```bash
   kubectl rollout restart deployment/basebook-router -n basebook
   ```
3. **Rollback**:
   ```bash
   kubectl rollout undo deployment/basebook-router -n basebook
   ```

---

## Performance Tuning

### 1. CPU Optimization

```bash
# Set worker threads to CPU core count
WORKER_THREADS=8
```

### 2. Memory Optimization

```bash
# Adjust cache size based on memory
CACHE_MAX_ENTRIES=50000  # ~32MB for 50K routes
```

### 3. Network Optimization

```bash
# Use HTTP/2
# Enable keep-alive
# Use CDN for static assets
```

---

## Maintenance

### Regular Tasks

1. **Daily**
   - Check error logs
   - Monitor performance metrics
   - Verify cache hit rate

2. **Weekly**
   - Review performance trends
   - Check for updates
   - Analyze slow queries

3. **Monthly**
   - Update dependencies
   - Security audit
   - Capacity planning

### Updates

```bash
# Pull latest image
docker pull basebook-router:latest

# Rolling update (Kubernetes)
kubectl set image deployment/basebook-router router=basebook-router:latest -n basebook

# Zero-downtime update (Docker Compose)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build router
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting guide.

### Quick Checks

```bash
# Check health
curl https://router.basebook.fi/health

# Check logs
kubectl logs -f deployment/basebook-router -n basebook --tail=100

# Check metrics
curl http://localhost:9090/metrics
```

---

## Cost Optimization

### RPC Costs

- Use caching aggressively (15s TTL)
- Batch RPC calls when possible
- Consider running own Base node for high volume

### Infrastructure Costs

- **Minimum**: $20/month (1 instance, 512MB RAM, 0.5 CPU)
- **Recommended**: $100/month (3 instances, load balancer, monitoring)
- **High-scale**: $500+/month (10+ instances, CDN, multi-region)

---

## Support

For deployment issues:
- **Documentation**: This guide + README.md
- **GitHub Issues**: [basebook/dex/issues](https://github.com/basebook/dex/issues)
- **Discord**: [BaseBook Community](https://discord.gg/basebook)

---

**Production Deployment Checklist:**

- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Backups configured
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Incident response plan ready

---

**Deployed successfully? Test your router:**

```bash
curl -X GET 'https://router.basebook.fi/v1/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount_in=1000000000000000000'
```

🚀 **Your BaseBook Router is now live!**
