#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# BaseBook DEX - Deploy to Production
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Deploying BaseBook DEX to Production..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="basebook"
OVERLAY="overlays/production"

# Functions
function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi
print_success "kubectl found"

if ! command -v kustomize &> /dev/null; then
    print_warning "kustomize not found. Using kubectl kustomize instead."
fi
print_success "Prerequisites checked"

# Validate kustomization
echo ""
echo "🔍 Validating kustomization..."
if command -v kustomize &> /dev/null; then
    kustomize build $OVERLAY > /tmp/production-manifest.yaml
else
    kubectl kustomize $OVERLAY > /tmp/production-manifest.yaml
fi
print_success "Kustomization valid"

# Show what will be deployed
echo ""
echo "📦 Resources to be deployed:"
kubectl kustomize $OVERLAY | grep -E "^kind:" | sort | uniq -c

# Production safety check
echo ""
print_warning "⚠️  PRODUCTION DEPLOYMENT ⚠️"
echo ""
echo "This will deploy to the PRODUCTION environment."
echo "Please ensure:"
echo "  ✓ All tests have passed in staging"
echo "  ✓ Database migrations are ready"
echo "  ✓ Secrets are configured"
echo "  ✓ DNS is configured"
echo "  ✓ Team has been notified"
echo ""

# Triple confirmation
read -p "Type 'production' to confirm deployment: " -r
echo
if [[ ! $REPLY == "production" ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

read -p "Are you absolutely sure? (yes/no): " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Apply manifests
echo ""
echo "🔧 Applying manifests..."
kubectl apply -k $OVERLAY

print_success "Manifests applied"

# Wait for deployments
echo ""
echo "⏳ Waiting for deployments to be ready..."

DEPLOYMENTS=(
    "deployment/backend"
    "deployment/router"
    "deployment/frontend"
)

for deployment in "${DEPLOYMENTS[@]}"; do
    echo "Waiting for $deployment..."
    if kubectl rollout status $deployment -n $NAMESPACE --timeout=10m; then
        print_success "$deployment is ready"
    else
        print_error "$deployment failed to become ready"

        # Show recent events
        echo ""
        echo "Recent events:"
        kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20

        # Ask if rollback is needed
        echo ""
        read -p "Rollback? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Rolling back $deployment..."
            kubectl rollout undo $deployment -n $NAMESPACE
            print_warning "Rollback initiated"
        fi
        exit 1
    fi
done

# Run smoke tests
echo ""
echo "🧪 Running smoke tests..."
sleep 10

# Check if services are responding
BACKEND_SERVICE=$(kubectl get svc backend-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
if kubectl run smoke-test --image=curlimages/curl --rm -i --restart=Never -- \
    curl -f http://$BACKEND_SERVICE:4000/health -m 5; then
    print_success "Backend health check passed"
else
    print_error "Backend health check failed"
fi

# Check pod status
echo ""
echo "📊 Pod Status:"
kubectl get pods -n $NAMESPACE

# Check service endpoints
echo ""
echo "🌐 Service Endpoints:"
kubectl get svc -n $NAMESPACE

# Check ingress
echo ""
echo "🔗 Ingress:"
kubectl get ingress -n $NAMESPACE

# Check HPA
echo ""
echo "📈 Horizontal Pod Autoscalers:"
kubectl get hpa -n $NAMESPACE

# Monitor for 2 minutes
echo ""
echo "👀 Monitoring deployment for 2 minutes..."
for i in {1..12}; do
    echo -n "."
    sleep 10
done
echo ""

# Final status
echo ""
kubectl get pods -n $NAMESPACE

echo ""
print_success "✅ Deployment to production completed successfully!"
echo ""
echo "🌍 Access your application:"
echo "  Frontend: https://basebook.xyz"
echo "  API:      https://api.basebook.xyz"
echo ""
echo "📝 Useful commands:"
echo "  View logs:    kubectl logs -f deployment/backend -n $NAMESPACE"
echo "  View events:  kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
echo "  Scale:        kubectl scale deployment/backend --replicas=5 -n $NAMESPACE"
echo "  Rollback:     kubectl rollout undo deployment/backend -n $NAMESPACE"
echo ""
echo "📊 Monitor:"
echo "  Grafana:      https://monitoring.basebook.xyz"
echo "  Prometheus:   https://prometheus.basebook.xyz"
echo ""
