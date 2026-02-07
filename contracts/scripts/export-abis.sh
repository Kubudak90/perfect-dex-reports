#!/bin/bash

# BaseBook DEX - ABI Export Script
# Extracts ABIs from forge build artifacts and creates TypeScript wrappers

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           BaseBook DEX - ABI Export                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
CONTRACTS=("PoolManager" "SwapRouter" "Quoter" "PositionManager")
OUT_DIR="out"
ABI_DIR="abis"

# Check if out/ directory exists
if [ ! -d "$OUT_DIR" ]; then
  echo "❌ Error: $OUT_DIR directory not found"
  echo "   Run 'forge build' first"
  exit 1
fi

# Create abis directory
mkdir -p "$ABI_DIR"

echo "Extracting ABIs from build artifacts..."
echo ""

# Extract JSON ABIs
for contract in "${CONTRACTS[@]}"; do
  SOURCE="$OUT_DIR/${contract}.sol/${contract}.json"
  DEST="$ABI_DIR/${contract}.json"

  if [ -f "$SOURCE" ]; then
    jq '.abi' "$SOURCE" > "$DEST"
    echo "✅ Exported: $DEST"
  else
    echo "❌ Warning: $SOURCE not found (skipping)"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  Export Complete!                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Generated files:"
ls -lh "$ABI_DIR"/*.json | awk '{print "  " $9, "(" $5 ")"}'
echo ""
echo "TypeScript wrappers are manually maintained in:"
echo "  - abis/PoolManager.ts"
echo "  - abis/SwapRouter.ts"
echo "  - abis/Quoter.ts"
echo "  - abis/PositionManager.ts"
echo "  - abis/index.ts"
echo ""
echo "To copy to frontend:"
echo "  cp -r abis ../frontend/src/lib/constants/"
echo ""
echo "To copy to backend:"
echo "  cp -r abis ../backend/src/blockchain/"
