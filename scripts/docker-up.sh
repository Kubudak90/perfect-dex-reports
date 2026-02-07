#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# BaseBook DEX - Start Development Environment
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Starting BaseBook DEX Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    exit 1
fi

# Pull latest images
echo "📦 Pulling latest images..."
docker-compose pull

# Start services
echo "🔧 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "📍 Services:"
echo "   Frontend:   http://localhost:3000"
echo "   Backend:    http://localhost:4000"
echo "   Router:     http://localhost:8080"
echo "   PostgreSQL: localhost:5432"
echo "   Redis:      localhost:6379"
echo "   Grafana:    http://localhost:3001 (admin/admin)"
echo "   Prometheus: http://localhost:9090"
echo ""
echo "📝 Useful commands:"
echo "   View logs:     docker-compose logs -f [service]"
echo "   Stop all:      docker-compose down"
echo "   Clean volumes: docker-compose down -v"
echo ""
