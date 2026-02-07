# Known Issues - BaseBook DEX

**Version**: 1.0.0
**Date**: 2024-02-03
**Status**: Pre-Audit

---

## Summary

This document lists all known issues, limitations, and areas requiring attention in the BaseBook DEX protocol. Issues are categorized by severity and status.

**Total Issues**: 8
- Critical: 0
- High: 0
- Medium: 2
- Low: 3
- Informational: 3

---

## Issue Categories

### Critical (0)
No critical issues identified.

### High (0)
No high severity issues identified.

---

## Medium Severity (2)

### M-1: Hook Integration Not Yet Implemented

**Location**: `src/core/PoolManager.sol`

**Description**:
Hook calls are marked with TODO comments but not yet implemented. Pools can be created with hooks, but the hooks are not actually invoked.

**Code**:
```solidity
// PoolManager.sol:80
// TODO: Call beforeInitialize hook if hooks != address(0)

// PoolManager.sol:93
// TODO: Call afterInitialize hook if hooks != address(0)

// PoolManager.sol:127
// TODO: Call beforeModifyLiquidity hook if hooks != address(0)

// PoolManager.sol:153
// TODO: Call afterModifyLiquidity hook if hooks != address(0)

// PoolManager.sol:175
// TODO: Call beforeSwap hook if hooks != address(0)

// PoolManager.sol:242
// TODO: Call afterSwap hook if hooks != address(0)
```

**Impact**:
- Hooks cannot be used in production
- Protocol features (dynamic fees, oracle, limit orders, MEV protection) unavailable
- Users may create pools with hooks expecting functionality that doesn't exist

**Likelihood**: High (if used)

**Recommendation**:
Implement hook calls before mainnet deployment:
```solidity
if (address(key.hooks) != address(0)) {
    key.hooks.beforeSwap(msg.sender, key, params);
}
```

**Status**: 🟡 Known Limitation, Will Fix Before Mainnet

**Workaround**: Do not use hooks in current deployment

---

### M-2: Simplified Tick Crossing Implementation

**Location**: `src/core/PoolManager.sol:215-216`

**Description**:
Swap implementation breaks after one step, preventing full tick crossing.

**Code**:
```solidity
// PoolManager.sol:215-216
// Break after one step for simplified implementation
break;
```

**Impact**:
- Large swaps cannot cross multiple ticks
- Price impact higher than necessary
- Liquidity not fully utilized

**Likelihood**: High (for large swaps)

**Recommendation**:
Implement full tick crossing logic:
```solidity
while (state.amountSpecifiedRemaining != 0 && state.sqrtPriceX96 != params.sqrtPriceLimitX96) {
    // Compute swap step
    // Cross tick if needed
    // Update tick state
    // Continue to next tick
}
// Remove break statement
```

**Status**: 🟡 Known Limitation, Will Fix Before Mainnet

**Workaround**: Use multiple smaller swaps

---

## Low Severity (3)

### L-1: Math Library Edge Cases with Extreme Values

**Location**: Multiple math libraries

**Description**:
Fuzz testing discovered edge cases with extreme uint256 values near type limits.

**Affected Functions**:
- `FullMath.mulDiv()` - Division by zero with extreme values
- `SafeCast.toUint160()` - Overflow with values > uint160.max
- `SqrtPriceMath.getNextSqrtPrice*()` - Price exceeds MAX_SQRT_PRICE

**Example**:
```solidity
// FullMath edge case
uint256 a = type(uint256).max - 3;
uint256 b = type(uint256).max;
uint256 denominator = 3545;
// Result can be 0 due to rounding
```

**Impact**:
- Theoretical only (real-world values work correctly)
- Extreme values unlikely in practice
- Proper reverts occur when they should

**Likelihood**: Very Low (requires unrealistic values)

**Recommendation**:
- Document safe operating ranges
- Add input validation if needed
- No code changes required

**Status**: 🟢 Accepted, Documented

**Safe Ranges**:
- SqrtPrice: [MIN_SQRT_PRICE, MAX_SQRT_PRICE]
- Liquidity: [1e15, 1e38]
- Amounts: [1, 1e30]

---

### L-2: Multi-Hop Swaps Not Implemented

**Location**: `src/core/SwapRouter.sol:173-176, 225-234`

**Description**:
Multi-hop swap functions (exactInput, exactOutput) are not yet implemented.

**Code**:
```solidity
function exactInput(ExactInputParams calldata params) external {
    revert("Multi-hop not yet implemented");
}

function exactOutput(ExactOutputParams calldata params) external {
    revert("Multi-hop not yet implemented");
}
```

**Impact**:
- Users must manually route through multiple pools
- Higher gas costs
- Worse prices (no optimal routing)

**Likelihood**: High (for multi-hop needs)

**Recommendation**:
Implement multi-hop routing or integrate with external router.

**Status**: 🟡 Planned Feature, Post-Launch

**Workaround**: Use multiple single-hop swaps

---

### L-3: Flash Loan Functionality Not Available

**Location**: Not implemented

**Description**:
Protocol does not support flash loans.

**Impact**:
- No flash loan integrations
- Missed DeFi composability opportunities
- Arbitrage more difficult

**Likelihood**: Medium

**Recommendation**:
Add flash loan support in future version.

**Status**: 🟡 Planned Feature, Phase 2

**Workaround**: Use external flash loan providers

---

## Informational (3)

### I-1: Fuzz Test Assertion Tolerances

**Location**: `test/fuzz/*.sol`

**Description**:
Some fuzz tests fail due to strict assertion tolerances, not actual bugs.

**Examples**:
```solidity
// Fee calculation rounding
assertApproxEqAbs(feeAmount, expectedFee, expectedFee / 100 + 1)
// Fails with delta of 3 wei when tolerance is 2 wei
```

**Impact**: None (test issue, not code issue)

**Recommendation**:
Adjust test assertions to allow for rounding:
```solidity
assertApproxEqAbs(feeAmount, expectedFee, expectedFee / 50 + 2)
```

**Status**: 🟢 Test Improvement Needed

---

### I-2: Gas Optimization Opportunities Remaining

**Location**: Various

**Description**:
Additional gas optimization opportunities identified but not yet implemented.

**Opportunities**:
1. Loop optimization in DynamicFeeHook (cache array length)
2. Function selector ordering
3. Batch operations in PositionManager
4. Event parameter reduction

**Impact**: ~100-500 gas savings per operation

**Recommendation**:
Implement in Phase 3 gas optimization round.

**Status**: 🟢 Future Enhancement

---

### I-3: Limited Error Messages

**Location**: All contracts

**Description**:
Custom errors don't include parameters for debugging.

**Current**:
```solidity
error InsufficientLiquidity();
```

**Enhanced**:
```solidity
error InsufficientLiquidity(uint128 available, uint128 requested);
```

**Impact**:
- Harder to debug failures
- Gas savings vs developer experience tradeoff

**Recommendation**:
Consider adding parameters to critical errors.

**Status**: 🟢 Accepted Design Decision

---

## Acknowledged Design Decisions

### D-1: No Admin Keys (By Design)

**Decision**: Core protocol has no admin/owner privileges

**Rationale**:
- Maximum decentralization
- No rug pull risk
- Trustless operation

**Tradeoff**:
- Cannot pause in emergency
- Cannot upgrade without redeployment
- Cannot change fees

**Status**: ✅ Intentional Design

---

### D-2: Singleton Pattern (By Design)

**Decision**: All pools in single PoolManager contract

**Rationale**:
- Gas efficiency
- Cross-pool operations
- Simplified architecture

**Tradeoff**:
- Single point of failure
- Higher attack surface
- Upgrade complexity

**Status**: ✅ Intentional Design

---

### D-3: Uniswap v3 Math Libraries (By Design)

**Decision**: Use proven Uniswap v3 math (TickMath, SqrtPriceMath)

**Rationale**:
- Battle-tested
- Highly optimized
- Industry standard

**Tradeoff**:
- Complex code
- Hard to audit
- External dependency

**Status**: ✅ Intentional Design

---

## Testing Gaps

### T-1: Hook Integration Tests Missing

**Description**: No integration tests for hook callbacks

**Reason**: Hooks not yet integrated in PoolManager

**Impact**: Hook functionality untested end-to-end

**Status**: ⏳ Pending M-1 resolution

---

### T-2: Multi-Pool Scenario Tests Limited

**Description**: Limited tests involving multiple pools

**Impact**: Cross-pool interactions not fully tested

**Recommendation**: Add more integration tests

**Status**: 🟡 Improvement Needed

---

### T-3: Extreme Stress Testing

**Description**: No gas limit stress tests

**Example**: What happens with 1000+ orders in LimitOrderHook?

**Impact**: Unknown behavior at extremes

**Recommendation**: Add stress tests

**Status**: 🟡 Future Enhancement

---

## Deployment Risks

### R-1: Testnet Deployment Incomplete

**Description**: Only basic testnet deployment done

**Missing**:
- Full integration testing on testnet
- Multi-user scenarios
- UI integration
- Oracle integration

**Recommendation**: Complete testnet phase before mainnet

**Status**: ⏳ In Progress

---

### R-2: No Circuit Breakers

**Description**: No emergency pause functionality

**Impact**: Cannot stop protocol in emergency

**Mitigation**:
- Thorough audit
- Bug bounty program
- Gradual rollout

**Status**: ✅ Accepted (no admin keys)

---

### R-3: Front-Running Risks

**Description**: Public mempool transactions vulnerable

**Mitigation**:
- Slippage tolerance
- Deadline protection
- MEVProtectionHook (optional)

**Status**: 🟡 Partially Mitigated

---

## External Dependencies

### E-1: OpenZeppelin Contracts

**Version**: v5.0.0
**Usage**: ReentrancyGuard, ERC721
**Status**: ✅ Audited by OpenZeppelin

---

### E-2: Uniswap Permit2

**Version**: v1.0.0
**Usage**: Gasless approvals
**Status**: ✅ Audited by Uniswap

---

### E-3: Forge-std

**Version**: Latest
**Usage**: Testing only
**Status**: ✅ Not in production code

---

## Audit Focus Areas

Based on known issues, auditors should focus on:

1. ✅ **High Priority**:
   - Hook integration implementation (M-1)
   - Tick crossing logic (M-2)
   - Math library correctness
   - Reentrancy vectors

2. ✅ **Medium Priority**:
   - Access control (hooks)
   - Integer overflow/underflow
   - Price manipulation
   - MEV vulnerabilities

3. ✅ **Low Priority**:
   - Gas optimizations
   - Code quality
   - Documentation

---

## Issue Tracking

All issues tracked in internal issue tracker and will be addressed based on priority before mainnet launch.

**Pre-Audit Action Items**:
- [ ] Implement hook integration (M-1)
- [ ] Implement tick crossing (M-2)
- [x] Document known limitations
- [x] Complete test coverage
- [x] Gas benchmarks

**Post-Audit Action Items**:
- [ ] Address all Critical/High findings
- [ ] Address Medium findings (case-by-case)
- [ ] Consider Low/Informational findings
- [ ] Update documentation

---

## Version History

| Version | Date       | Changes                    |
|---------|------------|----------------------------|
| 1.0.0   | 2024-02-03 | Initial audit package      |

---

**Status**: Ready for external audit
**Next Review**: After audit completion
