#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# BaseBook DEX - Stop Development Environment
# ═══════════════════════════════════════════════════════════════

set -e

echo "🛑 Stopping BaseBook DEX Development Environment..."

# Ask if user wants to remove volumes
read -p "Remove volumes (will delete all data)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Stopping and removing volumes..."
    docker-compose down -v
    echo "✅ All services stopped and volumes removed"
else
    echo "🗑️  Stopping services (keeping volumes)..."
    docker-compose down
    echo "✅ All services stopped (volumes preserved)"
fi

echo ""
echo "💡 To start again: ./scripts/docker-up.sh"
echo ""
