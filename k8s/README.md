# BaseBook DEX - Kubernetes Manifests

Complete Kubernetes deployment manifests for BaseBook DEX with support for staging and production environments.

## Table of Contents
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Directory Structure](#directory-structure)
- [Deployments](#deployments)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Ingress Controller                      │
│                  (Nginx + cert-manager)                     │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
    ┌────────▼────────┐        ┌────────▼────────┐
    │   Frontend      │        │   Backend API   │
    │   (2-8 pods)    │        │   (3-10 pods)   │
    └─────────────────┘        └────────┬────────┘
                                        │
                               ┌────────▼────────┐
                               │  Rust Router    │
                               │   (2-6 pods)    │
                               └─────────────────┘
```

## Prerequisites

### Required
- Kubernetes 1.24+
- kubectl CLI
- kustomize 4.0+

### Recommended
- Helm 3.x (for cert-manager, nginx-ingress)
- External PostgreSQL (RDS, Cloud SQL)
- External Redis (ElastiCache, Cloud Memorystore)

### Optional
- Prometheus Operator (for ServiceMonitors)
- cert-manager (for automatic TLS)
- External Secrets Operator (for secret management)

## Quick Start

### 1. Deploy to Staging

```bash
# Review the configuration
kubectl kustomize k8s/overlays/staging

# Apply to cluster
kubectl apply -k k8s/overlays/staging

# Check deployment status
kubectl get pods -n basebook-staging
kubectl get svc -n basebook-staging
kubectl get ingress -n basebook-staging
```

### 2. Deploy to Production

```bash
# Review the configuration
kubectl kustomize k8s/overlays/production

# Apply to cluster
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl get pods -n basebook
kubectl get svc -n basebook
kubectl get ingress -n basebook
```

### 3. Update Secrets

```bash
# Create secrets from file
kubectl create secret generic basebook-secrets \
  --from-env-file=.env.production \
  --namespace=basebook \
  --dry-run=client -o yaml | kubectl apply -f -

# Or manually
kubectl edit secret basebook-secrets -n basebook
```

## Directory Structure

```
k8s/
├── base/                           # Base manifests
│   ├── namespace.yaml              # Namespace definition
│   ├── configmap.yaml              # Configuration
│   ├── secret.yaml                 # Secrets (template)
│   ├── serviceaccount.yaml         # Service accounts
│   │
│   ├── backend-deployment.yaml     # Backend deployment
│   ├── backend-service.yaml        # Backend service
│   ├── backend-hpa.yaml            # Backend autoscaling
│   │
│   ├── router-deployment.yaml      # Router deployment
│   ├── router-service.yaml         # Router service
│   ├── router-hpa.yaml             # Router autoscaling
│   │
│   ├── frontend-deployment.yaml    # Frontend deployment
│   ├── frontend-service.yaml       # Frontend service
│   ├── frontend-hpa.yaml           # Frontend autoscaling
│   │
│   ├── ingress.yaml                # Ingress configuration
│   ├── pdb.yaml                    # Pod disruption budgets
│   ├── networkpolicy.yaml          # Network policies
│   ├── servicemonitor.yaml         # Prometheus monitors
│   └── kustomization.yaml          # Base kustomization
│
├── overlays/
│   ├── staging/                    # Staging environment
│   │   └── kustomization.yaml      # Staging patches
│   │
│   └── production/                 # Production environment
│       └── kustomization.yaml      # Production patches
│
└── README.md                       # This file
```

## Deployments

### Backend API

**Purpose**: REST API server with WebSocket support

**Specs**:
- Replicas: 3 (production), 2 (staging)
- CPU: 500m request, 1000m limit
- Memory: 512Mi request, 1Gi limit
- Ports: 4000 (HTTP), 4001 (WS), 9090 (metrics)

**Health Checks**:
- Liveness: `/health` (30s initial delay)
- Readiness: `/ready` (10s initial delay)
- Startup: `/health` (30 failures = 5 minutes)

**Autoscaling (HPA)**:
- Min: 3, Max: 10
- Target CPU: 70%
- Target Memory: 80%
- Custom: http_requests_per_second < 1000

### Router (Rust)

**Purpose**: Optimal path finding and swap simulation

**Specs**:
- Replicas: 2 (production), 1 (staging)
- CPU: 1000m request, 2000m limit (CPU-intensive)
- Memory: 1Gi request, 2Gi limit
- Ports: 8080 (HTTP), 9091 (metrics)

**Health Checks**:
- Liveness: `/health` (15s initial delay)
- Readiness: `/ready` (5s initial delay)
- Startup: `/health` (30 failures = 5 minutes)

**Autoscaling (HPA)**:
- Min: 2, Max: 6
- Target CPU: 60% (lower threshold due to CPU-intensive work)
- Target Memory: 70%
- Custom: route_calculations_per_second < 100

### Frontend (Next.js)

**Purpose**: User-facing web application

**Specs**:
- Replicas: 2 (production), 1 (staging)
- CPU: 250m request, 500m limit
- Memory: 256Mi request, 512Mi limit
- Port: 3000 (HTTP)

**Health Checks**:
- Liveness: `/api/health` (30s initial delay)
- Readiness: `/api/health` (10s initial delay)
- Startup: `/api/health` (30 failures = 5 minutes)

**Autoscaling (HPA)**:
- Min: 2, Max: 8
- Target CPU: 70%
- Target Memory: 80%

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend --replicas=5 -n basebook

# Scale router
kubectl scale deployment router --replicas=4 -n basebook

# Scale frontend
kubectl scale deployment frontend --replicas=6 -n basebook
```

### Horizontal Pod Autoscaler (HPA)

All deployments have HPA configured. View status:

```bash
# Check HPA status
kubectl get hpa -n basebook

# Describe HPA
kubectl describe hpa backend-hpa -n basebook

# Watch HPA in real-time
kubectl get hpa -n basebook --watch
```

### HPA Behavior

**Scale Up**:
- Fast response (0s stabilization)
- Max: 100% increase or 2 pods per 15s
- Prevents slow scale-up during traffic spikes

**Scale Down**:
- Slow response (300s stabilization)
- Max: 50% decrease or 1 pod per 60s
- Prevents flapping during traffic fluctuations

### Pod Disruption Budgets (PDB)

Ensures minimum availability during voluntary disruptions:

```bash
# Check PDB status
kubectl get pdb -n basebook

# Describe PDB
kubectl describe pdb backend-pdb -n basebook
```

**Configuration**:
- Backend: Min 2 pods available
- Router: Min 1 pod available
- Frontend: Min 1 pod available

## Monitoring

### Prometheus Integration

ServiceMonitors are provided for Prometheus Operator:

```bash
# Check ServiceMonitors
kubectl get servicemonitor -n basebook

# View metrics endpoints
kubectl get svc -n basebook -o wide
```

**Metrics Endpoints**:
- Backend: `http://backend-service:9090/metrics`
- Router: `http://router-service:9091/metrics`

### Logs

```bash
# View logs
kubectl logs -f deployment/backend -n basebook

# View logs from specific container
kubectl logs -f deployment/backend -c backend -n basebook

# View logs from all replicas
kubectl logs -f -l component=backend -n basebook

# View previous container logs
kubectl logs deployment/backend --previous -n basebook
```

### Events

```bash
# Watch events
kubectl get events -n basebook --watch

# View events for specific resource
kubectl describe pod backend-xxx-yyy -n basebook
```

## Security

### Network Policies

Network policies restrict traffic between pods:

```bash
# Check network policies
kubectl get networkpolicy -n basebook

# Describe policy
kubectl describe networkpolicy backend-network-policy -n basebook
```

**Rules**:
- Backend: Can access Router, PostgreSQL, Redis
- Router: Only accessible from Backend
- Frontend: Isolated, no backend communication

### Security Context

All pods run with:
- Non-root user (UID 1001)
- Read-only root filesystem
- Dropped all capabilities
- No privilege escalation

### RBAC

Service accounts are created for each component:

```bash
# Check service accounts
kubectl get sa -n basebook

# View service account details
kubectl describe sa basebook-backend -n basebook
```

### Secrets Management

**Never commit secrets!** Use one of:

1. **Sealed Secrets** (recommended)
```bash
kubeseal < secret.yaml > sealed-secret.yaml
kubectl apply -f sealed-secret.yaml
```

2. **External Secrets Operator**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: basebook-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: basebook-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: prod/basebook/database-url
```

3. **HashiCorp Vault**
```bash
vault kv put secret/basebook/production \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..."
```

## Operations

### Rolling Updates

```bash
# Update image
kubectl set image deployment/backend \
  backend=ghcr.io/basebook/backend:v1.2.3 \
  -n basebook

# Check rollout status
kubectl rollout status deployment/backend -n basebook

# View rollout history
kubectl rollout history deployment/backend -n basebook
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n basebook

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n basebook
```

### Restart

```bash
# Restart deployment (rolling restart)
kubectl rollout restart deployment/backend -n basebook
```

### Debug

```bash
# Execute command in pod
kubectl exec -it deployment/backend -n basebook -- sh

# Port forward
kubectl port-forward service/backend-service 4000:4000 -n basebook

# Copy files
kubectl cp backup.sql basebook/backend-xxx:/tmp/backup.sql
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n basebook

# Describe pod
kubectl describe pod backend-xxx -n basebook

# Check events
kubectl get events -n basebook --sort-by='.lastTimestamp'
```

**Common causes**:
- Image pull errors
- Resource limits too low
- Config/secret missing
- Init container failure

#### CrashLoopBackOff

```bash
# View logs
kubectl logs backend-xxx -n basebook --previous

# Check liveness probe
kubectl describe pod backend-xxx -n basebook | grep -A5 Liveness
```

**Common causes**:
- Application crashes
- Health check misconfigured
- Database connection failure
- Missing environment variables

#### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n basebook

# Check memory limits
kubectl describe pod backend-xxx -n basebook | grep -A5 Limits
```

**Solution**: Increase memory limits or investigate memory leaks

#### ImagePullBackOff

```bash
# Check image pull errors
kubectl describe pod backend-xxx -n basebook | grep -A10 Events
```

**Common causes**:
- Image doesn't exist
- Wrong image tag
- No image pull secrets
- Registry authentication failed

#### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n basebook
kubectl describe ingress basebook-ingress -n basebook

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

**Common causes**:
- DNS not configured
- TLS certificate issues
- Ingress controller not running
- Backend service not ready

### Health Checks

```bash
# Test from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://backend-service:4000/health

# Test from local machine (port-forward)
kubectl port-forward service/backend-service 4000:4000 -n basebook
curl http://localhost:4000/health
```

### Resource Usage

```bash
# Check current usage
kubectl top pods -n basebook
kubectl top nodes

# Check HPA metrics
kubectl get hpa -n basebook -o yaml
```

## Best Practices

### 1. Resource Limits
- Always set both requests and limits
- Requests: What pod needs
- Limits: Maximum allowed
- Test under load to find optimal values

### 2. Health Checks
- Use both liveness and readiness probes
- Set appropriate timeouts
- Include startup probes for slow-starting apps

### 3. High Availability
- Run multiple replicas (min 2-3)
- Use pod anti-affinity
- Configure PodDisruptionBudgets
- Use multiple availability zones

### 4. Security
- Run as non-root user
- Use read-only root filesystem
- Drop all capabilities
- Enable network policies
- Use secrets for sensitive data

### 5. Monitoring
- Expose metrics endpoint
- Configure ServiceMonitor
- Set up alerts
- Monitor logs centrally

### 6. Updates
- Use rolling updates
- Set maxUnavailable to 0
- Test in staging first
- Have rollback plan ready

## Advanced Topics

### Blue-Green Deployment

```bash
# Create green deployment
kubectl apply -f green-deployment.yaml

# Switch traffic
kubectl patch service backend-service -p '{"spec":{"selector":{"version":"green"}}}'

# Rollback if needed
kubectl patch service backend-service -p '{"spec":{"selector":{"version":"blue"}}}'
```

### Canary Deployment

Use Flagger or Argo Rollouts for automated canary deployments.

### Multi-Cluster

Use tools like:
- Kubefed (Kubernetes Federation)
- Rancher
- ArgoCD with ApplicationSet

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [HPA Walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)

---

**Maintained by**: DevOps Team
**Last Updated**: 2024-02-03
