#!/bin/bash

# Script to copy contract ABIs to frontend
# Run from project root: bash COPY_ABIS.sh
#
# Prerequisites:
#   - jq must be installed
#   - Run 'forge build' in contracts/ directory first (or pass --build flag)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_OUT="$SCRIPT_DIR/contracts/out"
ABIS_DIR="$SCRIPT_DIR/frontend/src/lib/constants/abis"

echo "Copying Contract ABIs to Frontend..."
echo ""

# Optional: build contracts first
if [ "$1" = "--build" ]; then
    echo "Building contracts..."
    (cd "$SCRIPT_DIR/contracts" && forge build)
    echo ""
fi

# Check prerequisites
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    echo "  Install with: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
    exit 1
fi

if [ ! -d "$CONTRACTS_OUT" ]; then
    echo "Error: contracts/out directory not found"
    echo "  Please run 'forge build' in contracts/ directory first"
    echo "  Or run: bash COPY_ABIS.sh --build"
    exit 1
fi

# Create ABIs directory
mkdir -p "$ABIS_DIR"

# Track success/failure
SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to extract ABI and create TypeScript file
# Args: contract_name, source_sol_file, ts_variable_name, source_dir_description
extract_abi() {
    local contract_name=$1
    local contract_file=$2
    local var_name=$3
    local source_desc=$4

    local artifact_path="$CONTRACTS_OUT/$contract_file/$contract_name.json"

    echo "  Extracting $contract_name ABI..."

    if [ ! -f "$artifact_path" ]; then
        echo "    WARNING: $artifact_path not found, skipping"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return
    fi

    # Validate that the artifact contains an ABI
    local abi_length
    abi_length=$(jq '.abi | length' "$artifact_path" 2>/dev/null)
    if [ -z "$abi_length" ] || [ "$abi_length" = "0" ] || [ "$abi_length" = "null" ]; then
        echo "    WARNING: No ABI found in $artifact_path, skipping"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return
    fi

    # Extract ABI using jq and create TypeScript file
    local ts_file="$ABIS_DIR/$contract_name.ts"
    local abi_json
    abi_json=$(jq '.abi' "$artifact_path")

    cat > "$ts_file" <<TSEOF
/**
 * $contract_name Contract ABI
 * Auto-generated from Foundry build artifacts
 * Source: contracts/src/$source_desc/$contract_name.sol
 */
export const $var_name = $abi_json as const;
TSEOF

    if [ $? -eq 0 ]; then
        echo "    OK: $contract_name.ts created ($abi_length entries)"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "    FAILED: Could not create $contract_name.ts"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo ""
echo "--- Core Contracts ---"
extract_abi "PoolManager"      "PoolManager.sol"      "POOL_MANAGER_ABI"      "core"
extract_abi "SwapRouter"       "SwapRouter.sol"       "SWAP_ROUTER_ABI"       "core"
extract_abi "Quoter"           "Quoter.sol"           "QUOTER_ABI"            "core"
extract_abi "PositionManager"  "PositionManager.sol"  "POSITION_MANAGER_ABI"  "core"

echo ""
echo "--- Hook Contracts ---"
extract_abi "DynamicFeeHook"     "DynamicFeeHook.sol"     "DYNAMIC_FEE_HOOK_ABI"     "hooks"
extract_abi "OracleHook"         "OracleHook.sol"         "ORACLE_HOOK_ABI"          "hooks"
extract_abi "LimitOrderHook"     "LimitOrderHook.sol"     "LIMIT_ORDER_HOOK_ABI"     "hooks"
extract_abi "MEVProtectionHook"  "MEVProtectionHook.sol"  "MEV_PROTECTION_HOOK_ABI"  "hooks"
extract_abi "TWAPOrderHook"      "TWAPOrderHook.sol"      "TWAP_ORDER_HOOK_ABI"      "hooks"
extract_abi "AutoCompoundHook"   "AutoCompoundHook.sol"   "AUTO_COMPOUND_HOOK_ABI"   "hooks"

# Create index file
echo ""
echo "  Creating index.ts..."
cat > "$ABIS_DIR/index.ts" << 'EOF'
/**
 * Contract ABIs Index
 * Auto-generated from Foundry build artifacts
 *
 * Import all contract ABIs from here:
 *   import { POOL_MANAGER_ABI, SWAP_ROUTER_ABI } from '@/lib/constants/abis';
 */

// Core contracts
export { POOL_MANAGER_ABI } from './PoolManager';
export { SWAP_ROUTER_ABI } from './SwapRouter';
export { QUOTER_ABI } from './Quoter';
export { POSITION_MANAGER_ABI } from './PositionManager';

// Hook contracts
export { DYNAMIC_FEE_HOOK_ABI } from './DynamicFeeHook';
export { ORACLE_HOOK_ABI } from './OracleHook';
export { LIMIT_ORDER_HOOK_ABI } from './LimitOrderHook';
export { MEV_PROTECTION_HOOK_ABI } from './MEVProtectionHook';
export { TWAP_ORDER_HOOK_ABI } from './TWAPOrderHook';
export { AUTO_COMPOUND_HOOK_ABI } from './AutoCompoundHook';
EOF

echo ""
echo "========================================="
echo "  Done! $SUCCESS_COUNT succeeded, $FAIL_COUNT failed"
echo "========================================="
echo ""
echo "Usage in your code:"
echo "  import { POOL_MANAGER_ABI, SWAP_ROUTER_ABI } from '@/lib/constants/abis';"
echo ""
