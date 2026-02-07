#!/bin/bash

# BaseBook DEX - Hook Deployment Script
# Chain: Base Sepolia
# PoolManager: 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         BaseBook DEX - Hook Deployment                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Load environment
source .env

# Configuration
POOL_MANAGER="0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05"
RPC_URL="$BASE_SEPOLIA_RPC_URL"

echo "Configuration:"
echo "  Chain: Base Sepolia (84532)"
echo "  PoolManager: $POOL_MANAGER"
echo "  RPC: $RPC_URL"
echo ""

# Deploy DynamicFeeHook
echo "=== Deploying DynamicFeeHook ==="
DYNAMIC_FEE=$(forge create src/hooks/DynamicFeeHook.sol:DynamicFeeHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ DynamicFeeHook: $DYNAMIC_FEE"
echo ""

# Deploy OracleHook
echo "=== Deploying OracleHook ==="
ORACLE=$(forge create src/hooks/OracleHook.sol:OracleHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ OracleHook: $ORACLE"
echo ""

# Deploy LimitOrderHook
echo "=== Deploying LimitOrderHook ==="
LIMIT_ORDER=$(forge create src/hooks/LimitOrderHook.sol:LimitOrderHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ LimitOrderHook: $LIMIT_ORDER"
echo ""

# Deploy MEVProtectionHook
echo "=== Deploying MEVProtectionHook ==="
MEV_PROTECTION=$(forge create src/hooks/MEVProtectionHook.sol:MEVProtectionHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ MEVProtectionHook: $MEV_PROTECTION"
echo ""

# Deploy TWAPOrderHook
echo "=== Deploying TWAPOrderHook ==="
TWAP_ORDER=$(forge create src/hooks/TWAPOrderHook.sol:TWAPOrderHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ TWAPOrderHook: $TWAP_ORDER"
echo ""

# Deploy AutoCompoundHook
echo "=== Deploying AutoCompoundHook ==="
AUTO_COMPOUND=$(forge create src/hooks/AutoCompoundHook.sol:AutoCompoundHook \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$POOL_MANAGER" \
  --legacy \
  --json | jq -r '.deployedTo')

echo "✅ AutoCompoundHook: $AUTO_COMPOUND"
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE!                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Deployed Hooks:"
echo "  DynamicFeeHook:      $DYNAMIC_FEE"
echo "  OracleHook:          $ORACLE"
echo "  LimitOrderHook:      $LIMIT_ORDER"
echo "  MEVProtectionHook:   $MEV_PROTECTION"
echo "  TWAPOrderHook:       $TWAP_ORDER"
echo "  AutoCompoundHook:    $AUTO_COMPOUND"
echo ""

# Save addresses to file
cat > hook-addresses.txt << EOF
# BaseBook DEX - Deployed Hook Addresses
# Chain: Base Sepolia (84532)
# Date: $(date)

PoolManager=$POOL_MANAGER

DynamicFeeHook=$DYNAMIC_FEE
OracleHook=$ORACLE
LimitOrderHook=$LIMIT_ORDER
MEVProtectionHook=$MEV_PROTECTION
TWAPOrderHook=$TWAP_ORDER
AutoCompoundHook=$AUTO_COMPOUND
EOF

echo "✅ Addresses saved to: hook-addresses.txt"
echo ""
echo "Next steps:"
echo "1. Verify contracts on Basescan"
echo "2. Update abis/addresses.ts with hook addresses"
echo "3. Test hooks with demo pools"
