#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# BaseBook DEX - Deploy to Staging
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Deploying BaseBook DEX to Staging..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="basebook-staging"
OVERLAY="overlays/staging"

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
    kustomize build $OVERLAY > /tmp/staging-manifest.yaml
else
    kubectl kustomize $OVERLAY > /tmp/staging-manifest.yaml
fi
print_success "Kustomization valid"

# Show what will be deployed
echo ""
echo "📦 Resources to be deployed:"
kubectl kustomize $OVERLAY | grep -E "^kind:" | sort | uniq -c

# Confirmation
echo ""
read -p "Deploy to staging? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
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
    "deployment/staging-backend"
    "deployment/staging-router"
    "deployment/staging-frontend"
)

for deployment in "${DEPLOYMENTS[@]}"; do
    echo "Waiting for $deployment..."
    if kubectl rollout status $deployment -n $NAMESPACE --timeout=5m; then
        print_success "$deployment is ready"
    else
        print_error "$deployment failed to become ready"
        exit 1
    fi
done

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

echo ""
print_success "Deployment to staging completed!"
echo ""
echo "🌍 Access your application:"
echo "  Frontend: https://staging.basebook.xyz"
echo "  API:      https://staging-api.basebook.xyz"
echo ""
echo "📝 Useful commands:"
echo "  View logs:    kubectl logs -f deployment/staging-backend -n $NAMESPACE"
echo "  View events:  kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
echo "  Scale:        kubectl scale deployment/staging-backend --replicas=5 -n $NAMESPACE"
echo "  Rollback:     kubectl rollout undo deployment/staging-backend -n $NAMESPACE"
echo ""
