#!/bin/bash

# Start Backend API in Mock Mode
# No PostgreSQL or Redis required!

echo "🔶 Starting Backend API in MOCK MODE..."
echo ""
echo "✅ No PostgreSQL required"
echo "✅ No Redis required"
echo "✅ Perfect for frontend development"
echo ""

# Set mock mode
export MOCK_MODE=true

# Start server
npm run dev
