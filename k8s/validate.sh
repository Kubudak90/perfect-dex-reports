#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# BaseBook DEX - Validate Kubernetes Manifests
# ═══════════════════════════════════════════════════════════════

set -e

echo "🔍 Validating Kubernetes Manifests..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ERRORS=0

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found"
    exit 1
fi
print_success "kubectl found"

if ! command -v kustomize &> /dev/null; then
    print_warning "kustomize not found. Using kubectl kustomize"
fi

# Validate base
echo ""
echo "🔧 Validating base manifests..."

if kubectl kustomize k8s/base > /tmp/base-manifest.yaml 2>&1; then
    print_success "Base kustomization valid"
else
    print_error "Base kustomization invalid"
fi

# Validate staging
echo ""
echo "🔧 Validating staging overlay..."

if kubectl kustomize k8s/overlays/staging > /tmp/staging-manifest.yaml 2>&1; then
    print_success "Staging overlay valid"
else
    print_error "Staging overlay invalid"
fi

# Validate production
echo ""
echo "🔧 Validating production overlay..."

if kubectl kustomize k8s/overlays/production > /tmp/production-manifest.yaml 2>&1; then
    print_success "Production overlay valid"
else
    print_error "Production overlay invalid"
fi

# Validate YAML syntax
echo ""
echo "📝 Validating YAML syntax..."

for file in k8s/base/*.yaml k8s/overlays/staging/*.yaml k8s/overlays/production/*.yaml; do
    if [ -f "$file" ]; then
        if kubectl apply --dry-run=client -f "$file" > /dev/null 2>&1; then
            print_success "$(basename $file)"
        else
            print_error "$(basename $file) - Invalid YAML"
        fi
    fi
done

# Check for common issues
echo ""
echo "🔎 Checking for common issues..."

# Check resource limits
if grep -q "resources:" /tmp/base-manifest.yaml; then
    print_success "Resource limits defined"
else
    print_warning "No resource limits found"
fi

# Check health checks
if grep -q "livenessProbe:" /tmp/base-manifest.yaml; then
    print_success "Liveness probes defined"
else
    print_error "No liveness probes found"
fi

if grep -q "readinessProbe:" /tmp/base-manifest.yaml; then
    print_success "Readiness probes defined"
else
    print_error "No readiness probes found"
fi

# Check security context
if grep -q "securityContext:" /tmp/base-manifest.yaml; then
    print_success "Security context defined"
else
    print_error "No security context found"
fi

# Check for latest tag
if grep -q "image:.*:latest" /tmp/production-manifest.yaml; then
    print_warning "Production using 'latest' tag (not recommended)"
fi

# Check for hardcoded secrets
if grep -qi "password" /tmp/base-manifest.yaml | grep -v "secretKeyRef"; then
    print_warning "Possible hardcoded password found"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    print_success "All validations passed!"
    echo ""
    echo "✅ Manifests are ready for deployment"
    exit 0
else
    print_error "Found $ERRORS error(s)"
    echo ""
    echo "❌ Please fix the errors before deploying"
    exit 1
fi
