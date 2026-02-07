#!/bin/bash
# ==============================================================================
# BaseBook DEX - Contract Verification Script for BaseScan
# ==============================================================================
#
# Verifies all deployed BaseBook DEX contracts on BaseScan (Etherscan for Base).
# Supports both Base Sepolia (testnet) and Base Mainnet.
#
# USAGE:
#   # Verify all contracts on Base Sepolia (default):
#   ./script/Verify.sh
#
#   # Verify all contracts on Base Mainnet:
#   ./script/Verify.sh mainnet
#
#   # Verify a single contract:
#   ./script/Verify.sh sepolia PoolManager
#   ./script/Verify.sh mainnet SwapRouter
#
#   # Dry run (print commands without executing):
#   DRY_RUN=1 ./script/Verify.sh
#
# PREREQUISITES:
#   - forge and cast must be installed (Foundry toolchain)
#   - BASESCAN_API_KEY must be set in .env or as environment variable
#   - Contracts must be compiled (run `forge build` first)
#
# NOTES:
#   - This script is idempotent: re-running will not cause errors.
#     Already-verified contracts will be reported as such by BaseScan.
#   - Constructor args are ABI-encoded automatically using `cast`.
#   - The script exits with status 0 even if individual verifications fail,
#     so you can re-run it to retry failed contracts.
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Color output helpers
# ==============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*"; }

# ==============================================================================
# Load environment
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_DIR/.env" ]; then
    info "Loading .env from $PROJECT_DIR/.env"
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# ==============================================================================
# Validate prerequisites
# ==============================================================================
if ! command -v forge &>/dev/null; then
    error "forge not found. Install Foundry: https://getfoundry.sh"
    exit 1
fi

if ! command -v cast &>/dev/null; then
    error "cast not found. Install Foundry: https://getfoundry.sh"
    exit 1
fi

if [ -z "${BASESCAN_API_KEY:-}" ]; then
    error "BASESCAN_API_KEY is not set. Add it to .env or export it."
    error "Get your API key at: https://basescan.org/myapikey"
    exit 1
fi

# ==============================================================================
# Network configuration
# ==============================================================================
NETWORK="${1:-sepolia}"
SINGLE_CONTRACT="${2:-}"

case "$NETWORK" in
    sepolia|testnet|base-sepolia)
        NETWORK="sepolia"
        CHAIN_ID="84532"
        VERIFIER_URL="https://api-sepolia.basescan.org/api"
        EXPLORER_URL="https://sepolia.basescan.org"
        info "Network: Base Sepolia (chain ID: $CHAIN_ID)"
        ;;
    mainnet|base)
        NETWORK="mainnet"
        CHAIN_ID="8453"
        VERIFIER_URL="https://api.basescan.org/api"
        EXPLORER_URL="https://basescan.org"
        info "Network: Base Mainnet (chain ID: $CHAIN_ID)"
        ;;
    *)
        error "Unknown network: $NETWORK"
        error "Usage: $0 [sepolia|mainnet] [ContractName]"
        exit 1
        ;;
esac

# ==============================================================================
# Contract addresses
# ==============================================================================
# Permit2 is deployed at the same address on all EVM chains
PERMIT2="0x000000000022D473030F116dDEE9F6B43aC78BA3"

if [ "$NETWORK" = "sepolia" ]; then
    # -------------------------------------------------------------------------
    # Base Sepolia addresses (from broadcast records)
    # -------------------------------------------------------------------------
    # Deployment 1 (DeploySimple + DeployRemaining):
    #   PoolManager:     0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
    #   SwapRouter:      0xFf438e2d528F55fD1141382D1eB436201552d1A5
    #   Quoter:          0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
    #   PositionManager: 0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA
    #
    # Deployment 2 (DeployCoreContracts):
    #   PoolManager:     0x9D080a250CE674A88EA8b4160D7E67D1F122D008
    #   SwapRouter:      0xEe3F621B3Bc962868a2B41D415Ec821594efF0D3
    #   Quoter:          0x6872107B67eB1c002CF214a03BA47a41eB0a9609
    #   PositionManager: 0xa72BbC3eF65c6105784429F6a1Fe10207472afD6
    #
    # Using Deployment 1 addresses (referenced in BASESCAN_VERIFY_GUIDE.md and
    # DeployHooks.s.sol). Update these if you redeploy.
    # -------------------------------------------------------------------------

    # Core contracts
    POOL_MANAGER_ADDR="${POOL_MANAGER_ADDR:-0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05}"
    SWAP_ROUTER_ADDR="${SWAP_ROUTER_ADDR:-0xFf438e2d528F55fD1141382D1eB436201552d1A5}"
    QUOTER_ADDR="${QUOTER_ADDR:-0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b}"
    POSITION_MANAGER_ADDR="${POSITION_MANAGER_ADDR:-0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA}"

    # Hook contracts (from DeployHooks broadcast, deployed against Deployment 1 PoolManager)
    DYNAMIC_FEE_HOOK_ADDR="${DYNAMIC_FEE_HOOK_ADDR:-0xD3424b4EeAE62dD38701fBd910ce18007f9A276b}"
    ORACLE_HOOK_ADDR="${ORACLE_HOOK_ADDR:-0x50BCeD57635b8C0Cf5603E5fA30DFaab3D2C27ea}"
    LIMIT_ORDER_HOOK_ADDR="${LIMIT_ORDER_HOOK_ADDR:-0x5a02AFA3C286559d696250898C7A47D4F9d6a7AC}"
    MEV_PROTECTION_HOOK_ADDR="${MEV_PROTECTION_HOOK_ADDR:-0xEBf84B06Ebe6492Ff89bFC1E68Fd8Ec9E540fB40}"
    TWAP_ORDER_HOOK_ADDR="${TWAP_ORDER_HOOK_ADDR:-0x94C3541740D13c175615608314AaCc3b136A6781}"
    AUTO_COMPOUND_HOOK_ADDR="${AUTO_COMPOUND_HOOK_ADDR:-0x879Ca2181056f1D2bB84C5579cbb65be22C0B71b}"

else
    # -------------------------------------------------------------------------
    # Base Mainnet addresses (fill in after mainnet deployment)
    # -------------------------------------------------------------------------
    POOL_MANAGER_ADDR="${POOL_MANAGER_ADDR:-0x0000000000000000000000000000000000000000}"
    SWAP_ROUTER_ADDR="${SWAP_ROUTER_ADDR:-0x0000000000000000000000000000000000000000}"
    QUOTER_ADDR="${QUOTER_ADDR:-0x0000000000000000000000000000000000000000}"
    POSITION_MANAGER_ADDR="${POSITION_MANAGER_ADDR:-0x0000000000000000000000000000000000000000}"

    DYNAMIC_FEE_HOOK_ADDR="${DYNAMIC_FEE_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
    ORACLE_HOOK_ADDR="${ORACLE_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
    LIMIT_ORDER_HOOK_ADDR="${LIMIT_ORDER_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
    MEV_PROTECTION_HOOK_ADDR="${MEV_PROTECTION_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
    TWAP_ORDER_HOOK_ADDR="${TWAP_ORDER_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
    AUTO_COMPOUND_HOOK_ADDR="${AUTO_COMPOUND_HOOK_ADDR:-0x0000000000000000000000000000000000000000}"
fi

# ==============================================================================
# Compiler settings (must match foundry.toml)
# ==============================================================================
COMPILER_VERSION="0.8.24"
OPTIMIZER_RUNS="1000000"
EVM_VERSION="cancun"

# ==============================================================================
# Verification function
# ==============================================================================
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

verify_contract() {
    local name="$1"
    local address="$2"
    local source_path="$3"
    local constructor_args="${4:-}"

    # Skip if address is zero (not deployed)
    if [ "$address" = "0x0000000000000000000000000000000000000000" ]; then
        warn "Skipping $name - not deployed (address is zero). Deploy first, then update the address."
        SKIP_COUNT=$((SKIP_COUNT + 1))
        return 0
    fi

    # Skip if filtering to a single contract
    if [ -n "$SINGLE_CONTRACT" ] && [ "$SINGLE_CONTRACT" != "$name" ]; then
        return 0
    fi

    info "Verifying $name at $address ..."

    # Build the forge verify-contract command
    local cmd="forge verify-contract"
    cmd="$cmd $address"
    cmd="$cmd $source_path:$name"
    cmd="$cmd --chain-id $CHAIN_ID"
    cmd="$cmd --etherscan-api-key $BASESCAN_API_KEY"
    cmd="$cmd --verifier-url $VERIFIER_URL"
    cmd="$cmd --compiler-version $COMPILER_VERSION"
    cmd="$cmd --num-of-optimizations $OPTIMIZER_RUNS"
    cmd="$cmd --evm-version $EVM_VERSION"

    if [ -n "$constructor_args" ]; then
        cmd="$cmd --constructor-args $constructor_args"
    fi

    cmd="$cmd --watch"

    # Dry run mode: just print the command
    if [ "${DRY_RUN:-0}" = "1" ]; then
        echo "  $cmd"
        echo ""
        return 0
    fi

    # Execute verification
    if eval "$cmd" 2>&1; then
        success "$name verified successfully!"
        success "  View: $EXPLORER_URL/address/$address#code"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        # Don't exit on failure -- allow other contracts to be verified
        error "$name verification failed. This may be because:"
        error "  - Contract is already verified (check $EXPLORER_URL/address/$address#code)"
        error "  - API rate limit (wait and retry)"
        error "  - Compiler settings mismatch"
        error "  To retry this single contract:"
        error "    $0 $NETWORK $name"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    echo ""
}

# ==============================================================================
# Header
# ==============================================================================
echo ""
echo "=================================================================="
echo "  BaseBook DEX - Contract Verification"
echo "  Network: $NETWORK ($CHAIN_ID)"
echo "  Explorer: $EXPLORER_URL"
echo "=================================================================="
echo ""

if [ "${DRY_RUN:-0}" = "1" ]; then
    warn "DRY RUN MODE - commands will be printed but not executed"
    echo ""
fi

# ==============================================================================
# Verify core contracts
# ==============================================================================
info "=== CORE CONTRACTS ==="
echo ""

# 1. PoolManager - no constructor args
verify_contract \
    "PoolManager" \
    "$POOL_MANAGER_ADDR" \
    "src/core/PoolManager.sol"

# 2. SwapRouter - constructor(address _poolManager, address _permit2)
SWAP_ROUTER_ARGS=$(cast abi-encode "constructor(address,address)" "$POOL_MANAGER_ADDR" "$PERMIT2" 2>/dev/null || echo "")
if [ -z "$SWAP_ROUTER_ARGS" ] && [ "$SWAP_ROUTER_ADDR" != "0x0000000000000000000000000000000000000000" ]; then
    error "Failed to encode SwapRouter constructor args with cast. Is cast installed?"
fi
verify_contract \
    "SwapRouter" \
    "$SWAP_ROUTER_ADDR" \
    "src/core/SwapRouter.sol" \
    "$SWAP_ROUTER_ARGS"

# 3. Quoter - constructor(address _poolManager)
QUOTER_ARGS=$(cast abi-encode "constructor(address)" "$POOL_MANAGER_ADDR" 2>/dev/null || echo "")
verify_contract \
    "Quoter" \
    "$QUOTER_ADDR" \
    "src/core/Quoter.sol" \
    "$QUOTER_ARGS"

# 4. PositionManager - constructor(address _poolManager)
POSITION_MANAGER_ARGS=$(cast abi-encode "constructor(address)" "$POOL_MANAGER_ADDR" 2>/dev/null || echo "")
verify_contract \
    "PositionManager" \
    "$POSITION_MANAGER_ADDR" \
    "src/core/PositionManager.sol" \
    "$POSITION_MANAGER_ARGS"

# ==============================================================================
# Verify hook contracts
# ==============================================================================
echo ""
info "=== HOOK CONTRACTS ==="
info "All hooks take constructor(address _poolManager)"
echo ""

# Encode the common constructor arg for all hooks
HOOK_ARGS=$(cast abi-encode "constructor(address)" "$POOL_MANAGER_ADDR" 2>/dev/null || echo "")

# 5. DynamicFeeHook - constructor(address _poolManager)
verify_contract \
    "DynamicFeeHook" \
    "$DYNAMIC_FEE_HOOK_ADDR" \
    "src/hooks/DynamicFeeHook.sol" \
    "$HOOK_ARGS"

# 6. OracleHook - constructor(address _poolManager)
verify_contract \
    "OracleHook" \
    "$ORACLE_HOOK_ADDR" \
    "src/hooks/OracleHook.sol" \
    "$HOOK_ARGS"

# 7. LimitOrderHook - constructor(address _poolManager)
verify_contract \
    "LimitOrderHook" \
    "$LIMIT_ORDER_HOOK_ADDR" \
    "src/hooks/LimitOrderHook.sol" \
    "$HOOK_ARGS"

# 8. MEVProtectionHook - constructor(address _poolManager)
verify_contract \
    "MEVProtectionHook" \
    "$MEV_PROTECTION_HOOK_ADDR" \
    "src/hooks/MEVProtectionHook.sol" \
    "$HOOK_ARGS"

# 9. TWAPOrderHook - constructor(address _poolManager)
verify_contract \
    "TWAPOrderHook" \
    "$TWAP_ORDER_HOOK_ADDR" \
    "src/hooks/TWAPOrderHook.sol" \
    "$HOOK_ARGS"

# 10. AutoCompoundHook - constructor(address _poolManager)
verify_contract \
    "AutoCompoundHook" \
    "$AUTO_COMPOUND_HOOK_ADDR" \
    "src/hooks/AutoCompoundHook.sol" \
    "$HOOK_ARGS"

# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo "=================================================================="
echo "  VERIFICATION SUMMARY"
echo "=================================================================="
echo ""
if [ "${DRY_RUN:-0}" != "1" ]; then
    success "Passed:  $PASS_COUNT"
    error   "Failed:  $FAIL_COUNT"
    warn    "Skipped: $SKIP_COUNT"
else
    info "Dry run complete. No commands were executed."
fi
echo ""
echo "  Compiler:    solc $COMPILER_VERSION"
echo "  Optimizer:   $OPTIMIZER_RUNS runs"
echo "  EVM Version: $EVM_VERSION"
echo "  Via IR:      true"
echo ""
echo "  Explorer: $EXPLORER_URL"
echo ""

if [ "$NETWORK" = "sepolia" ]; then
    echo "  Contract links (after verification):"
    echo "    PoolManager:       $EXPLORER_URL/address/$POOL_MANAGER_ADDR#code"
    echo "    SwapRouter:        $EXPLORER_URL/address/$SWAP_ROUTER_ADDR#code"
    echo "    Quoter:            $EXPLORER_URL/address/$QUOTER_ADDR#code"
    echo "    PositionManager:   $EXPLORER_URL/address/$POSITION_MANAGER_ADDR#code"
    echo "    DynamicFeeHook:    $EXPLORER_URL/address/$DYNAMIC_FEE_HOOK_ADDR#code"
    echo "    OracleHook:        $EXPLORER_URL/address/$ORACLE_HOOK_ADDR#code"
    echo "    LimitOrderHook:    $EXPLORER_URL/address/$LIMIT_ORDER_HOOK_ADDR#code"
    echo "    MEVProtectionHook: $EXPLORER_URL/address/$MEV_PROTECTION_HOOK_ADDR#code"
    echo "    TWAPOrderHook:     $EXPLORER_URL/address/$TWAP_ORDER_HOOK_ADDR#code"
    echo "    AutoCompoundHook:  $EXPLORER_URL/address/$AUTO_COMPOUND_HOOK_ADDR#code"
    echo ""
fi

echo "  To verify a single contract:"
echo "    $0 $NETWORK <ContractName>"
echo ""
echo "  To override an address at runtime:"
echo "    POOL_MANAGER_ADDR=0x... $0 $NETWORK PoolManager"
echo ""
echo "=================================================================="
