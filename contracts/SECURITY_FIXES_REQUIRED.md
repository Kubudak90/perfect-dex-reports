# 🚨 CRITICAL SECURITY FIXES - IMMEDIATE ACTION REQUIRED

## Priority Matrix

```
┌─────────────────────────────────────────────────────────────┐
│  BLOCKER - Must Fix Before ANY Deployment (24-48h)         │
├─────────────────────────────────────────────────────────────┤
│  [C-01] Missing Token Transfers in Hooks                    │
│  [C-02] Reentrancy Risk in Hook Contracts                   │
│  [H-01] Unsafe ETH Transfers                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CRITICAL - Fix Before Mainnet (1-2 weeks)                  │
├─────────────────────────────────────────────────────────────┤
│  [H-02] Centralization Risk                                 │
│  [H-03] Slippage Protection                                 │
│  [H-04] Integer Overflow in Fees                            │
└─────────────────────────────────────────────────────────────┘
```

---

## BLOCKER FIXES

### Fix #1: Implement Token Transfers in LimitOrderHook

**File**: `src/hooks/LimitOrderHook.sol`
**Lines**: 249, 272, 297
**Current Code**: TODO comments, no actual transfers
**Status**: ❌ BROKEN

#### Implementation

```solidity
// BEFORE (BROKEN):
function placeOrder(...) external returns (uint256 orderId) {
    // ... validation ...

    // TODO: Transfer tokens from user (requires approval)
    // ❌ NO ACTUAL TRANSFER

    emit OrderPlaced(...);
}

// AFTER (FIXED):
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LimitOrderHook is BaseHook, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    function placeOrder(
        PoolKey calldata poolKey,
        bool zeroForOne,
        int24 tick,
        uint128 amountIn,
        uint128 amountOutMinimum,
        uint32 deadline
    ) external nonReentrant returns (uint256 orderId) {
        bytes32 poolId = keccak256(abi.encode(poolKey));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();
        if (amountIn == 0) revert InvalidAmount();
        if (tick < TickMath.MIN_TICK || tick > TickMath.MAX_TICK) revert InvalidTick();
        if (deadline <= block.timestamp) revert InvalidAmount();

        // ✅ TRANSFER INPUT TOKENS
        Currency tokenIn = zeroForOne ? poolKey.currency0 : poolKey.currency1;

        if (!tokenIn.isNative()) {
            IERC20(Currency.unwrap(tokenIn)).safeTransferFrom(
                msg.sender,
                address(this),
                amountIn
            );
        } else {
            require(msg.value >= amountIn, "Insufficient ETH sent");
        }

        // Create order
        orderId = nextOrderId++;
        orders[orderId] = Order({
            owner: msg.sender,
            poolId: poolId,
            zeroForOne: zeroForOne,
            tick: tick,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            amountFilled: 0,
            deadline: deadline,
            status: OrderStatus.Open
        });

        userOrders[msg.sender].push(orderId);
        poolTickOrders[poolId][tick].push(orderId);

        emit OrderPlaced(orderId, msg.sender, poolId, zeroForOne, tick, amountIn, amountOutMinimum, deadline);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert Unauthorized();
        if (order.status == OrderStatus.Filled) revert OrderAlreadyFilled();
        if (order.status == OrderStatus.Cancelled) revert OrderAlreadyCancelled();

        order.status = OrderStatus.Cancelled;

        // ✅ RETURN UNFILLED TOKENS
        uint128 unfilledAmount = order.amountIn - order.amountFilled;
        if (unfilledAmount > 0) {
            PoolKey memory poolKey = _getPoolKey(order.poolId);
            Currency tokenIn = order.zeroForOne ? poolKey.currency0 : poolKey.currency1;

            if (!tokenIn.isNative()) {
                IERC20(Currency.unwrap(tokenIn)).safeTransfer(msg.sender, unfilledAmount);
            } else {
                Address.sendValue(payable(msg.sender), unfilledAmount);
            }
        }

        emit OrderCancelled(orderId);
    }

    function claimOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.owner != msg.sender) revert Unauthorized();
        if (order.status != OrderStatus.Filled && order.status != OrderStatus.PartiallyFilled) {
            revert OrderNotFound();
        }

        ClaimableAmount memory claimAmount = claimable[orderId];
        if (claimAmount.amount0 == 0 && claimAmount.amount1 == 0) revert ClaimFailed();

        delete claimable[orderId];

        // ✅ TRANSFER OUTPUT TOKENS
        PoolKey memory poolKey = _getPoolKey(order.poolId);

        if (claimAmount.amount0 > 0) {
            if (!poolKey.currency0.isNative()) {
                IERC20(Currency.unwrap(poolKey.currency0)).safeTransfer(
                    msg.sender,
                    claimAmount.amount0
                );
            } else {
                Address.sendValue(payable(msg.sender), claimAmount.amount0);
            }
        }

        if (claimAmount.amount1 > 0) {
            if (!poolKey.currency1.isNative()) {
                IERC20(Currency.unwrap(poolKey.currency1)).safeTransfer(
                    msg.sender,
                    claimAmount.amount1
                );
            } else {
                Address.sendValue(payable(msg.sender), claimAmount.amount1);
            }
        }

        emit OrderClaimed(orderId, msg.sender, claimAmount.amount0, claimAmount.amount1);
    }

    // Helper function to retrieve pool key from storage
    mapping(bytes32 => PoolKey) private poolKeyStorage;

    function _getPoolKey(bytes32 poolId) internal view returns (PoolKey memory) {
        return poolKeyStorage[poolId];
    }

    // Store pool key on initialization
    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));
        isPoolInitialized[poolId] = true;
        poolKeyStorage[poolId] = key;  // ✅ Store for later use
        return IHooks.afterInitialize.selector;
    }
}
```

**Testing Required**:
```solidity
function test_PlaceOrder_TransfersTokens() public {
    uint256 balanceBefore = token0.balanceOf(alice);

    vm.prank(alice);
    uint256 orderId = hook.placeOrder(poolKey, true, 100, 1000 ether, 900 ether, deadline);

    uint256 balanceAfter = token0.balanceOf(alice);
    assertEq(balanceBefore - balanceAfter, 1000 ether, "Tokens not transferred");
}
```

---

### Fix #2: Add Reentrancy Protection to All Hooks

**Files**: All hook contracts
**Current**: No ReentrancyGuard
**Status**: ❌ VULNERABLE

#### Implementation Pattern

```solidity
// Apply to ALL hooks:
// - TWAPOrderHook.sol
// - AutoCompoundHook.sol
// - LimitOrderHook.sol
// - MEVProtectionHook.sol
// - OracleHook.sol
// - DynamicFeeHook.sol

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TWAPOrderHook is BaseHook, ReentrancyGuard {

    // Add nonReentrant to ALL state-modifying functions
    function createTWAPOrder(...)
        external
        nonReentrant  // ✅ ADD THIS
        returns (uint256)
    {
        // ... implementation
    }

    function executeTWAPOrder(uint256 orderId)
        external
        nonReentrant  // ✅ ADD THIS
        returns (uint256, uint256)
    {
        // ... implementation
    }

    function cancelTWAPOrder(uint256 orderId)
        external
        nonReentrant  // ✅ ADD THIS
    {
        // ... implementation
    }
}
```

#### Why This Matters

**Attack Scenario WITHOUT Protection**:
```solidity
// Malicious token with reentrant callback
contract MaliciousToken is ERC20 {
    TWAPOrderHook hook;

    function transfer(address to, uint256 amount) public override returns (bool) {
        // Reenter during token transfer
        if (msg.sender == address(hook)) {
            // ❌ WITHOUT nonReentrant, this succeeds
            hook.executeTWAPOrder(attackerOrderId);
        }
        return super.transfer(to, amount);
    }
}
```

**With Protection**:
```solidity
// First call
executeTWAPOrder() -> nonReentrant sets lock

// Reentrant call during token transfer
executeTWAPOrder() -> nonReentrant REVERTS (lock already held)
```

---

### Fix #3: Safe ETH Transfers

**Files**:
- `src/core/SwapRouter.sol` (line 269)
- `src/core/PositionManager.sol` (line 453)

**Current**: Unsafe low-level call
**Status**: ❌ VULNERABLE

#### Implementation

```solidity
// BEFORE (UNSAFE):
function _pay(Currency currency, address payer, address recipient, uint256 amount) internal {
    if (currency.isNative()) {
        if (payer == address(this)) {
            // ❌ UNSAFE: No gas limit, no protection
            (bool success,) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        }
    }
}

// AFTER (SAFE):
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

function _pay(Currency currency, address payer, address recipient, uint256 amount) internal {
    if (amount == 0) return;

    if (currency.isNative()) {
        if (payer == address(this)) {
            // ✅ SAFE: Gas limit + revert handling
            Address.sendValue(payable(recipient), amount);
        } else {
            require(msg.value >= amount, "Insufficient ETH");
        }
    } else {
        if (payer == address(this)) {
            IERC20(Currency.unwrap(currency)).safeTransfer(recipient, amount);
        } else {
            IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, recipient, amount);
        }
    }
}
```

**Why Address.sendValue is Better**:

1. **Gas Limit**: Prevents griefing via expensive fallback
2. **Better Error Handling**: Clear revert messages
3. **Battle Tested**: Used in thousands of audited contracts
4. **Forwards 63/64 Gas**: Follows EIP-150 best practice

---

## CRITICAL FIXES

### Fix #4: Multi-Sig & Timelock for Admin Functions

**Files**: All hooks
**Current**: Single owner with immediate effect
**Status**: ❌ CENTRALIZATION RISK

#### Implementation

```solidity
// Option 1: OpenZeppelin Ownable2Step (Safer ownership)
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract TWAPOrderHook is BaseHook, ReentrancyGuard, Ownable2Step {
    constructor(address _poolManager) Ownable(msg.sender) {
        // ...
    }

    // Now requires 2-step transfer (propose + accept)
    // Prevents accidental transfer to wrong address
}

// Option 2: TimelockController (Delayed execution)
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract HookTimelock is TimelockController {
    constructor(
        uint256 minDelay,  // e.g., 2 days
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}

// Usage:
// 1. Deploy Timelock with 2-day delay
// 2. Transfer hook ownership to Timelock
// 3. Any parameter change requires 2-day waiting period
// 4. Community can react before changes take effect

// Option 3: Gnosis Safe Multi-Sig (Recommended for mainnet)
// 1. Deploy Gnosis Safe with 3/5 signers
// 2. Transfer ownership to Safe
// 3. All admin actions require 3 signatures
```

#### Critical Functions Requiring Protection

```solidity
// These functions should be behind timelock/multi-sig:
function setFeeCollector(address) external;
function updatePoolConfig(...) external;
function setExecutionFee(uint24) external;
function transferOwnership(address) external;
```

---

### Fix #5: Proper Slippage Calculation

**Files**: `src/hooks/LimitOrderHook.sol`, `src/hooks/TWAPOrderHook.sol`
**Current**: Simplified/placeholder calculations
**Status**: ❌ INCORRECT PRICING

#### Implementation

```solidity
// BEFORE (WRONG):
function _calculateAmountOut(Order storage order, uint128 amountIn)
    internal
    view
    returns (uint128)
{
    // ❌ Oversimplified - doesn't account for slippage
    uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(order.tick);
    uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;

    return order.zeroForOne
        ? uint128((uint256(amountIn) * price) / 1e18)
        : uint128((uint256(amountIn) * 1e18) / price);
}

// AFTER (CORRECT):
import {SqrtPriceMath} from "../libraries/SqrtPriceMath.sol";
import {SwapMath} from "../libraries/SwapMath.sol";

function _executeOrderSwap(Order storage order, uint128 amountToFill)
    internal
    returns (uint128 amountOut)
{
    PoolKey memory poolKey = _getPoolKey(order.poolId);

    // Get current pool state
    (uint160 sqrtPriceX96, int24 tick, , uint24 fee) = poolManager.getSlot0(order.poolId);
    uint128 liquidity = poolManager.getLiquidity(order.poolId);

    // Calculate actual swap using pool's math
    (
        uint160 sqrtPriceNextX96,
        uint256 amountIn,
        uint256 amountOutCalculated,
        uint256 feeAmount
    ) = SwapMath.computeSwapStep(
        sqrtPriceX96,
        order.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1,
        liquidity,
        int256(uint256(amountToFill)),
        fee
    );

    // Verify slippage protection
    amountOut = uint128(amountOutCalculated);
    require(amountOut >= order.amountOutMinimum, "Slippage exceeded");

    // Execute actual swap through PoolManager
    IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
        zeroForOne: order.zeroForOne,
        amountSpecified: int256(uint256(amountToFill)),
        sqrtPriceLimitX96: order.zeroForOne
            ? TickMath.getSqrtPriceAtTick(order.tick)
            : TickMath.getSqrtPriceAtTick(order.tick)
    });

    (int256 amount0, int256 amount1) = poolManager.swap(poolKey, params);

    // Use actual output from swap
    amountOut = uint128(uint256(-(order.zeroForOne ? amount1 : amount0)));
}
```

---

### Fix #6: Safe Fee Calculations

**Files**: All hooks with fee calculations
**Current**: Potential overflow on multiplication
**Status**: ⚠️ EDGE CASE RISK

#### Implementation

```solidity
// BEFORE (RISKY):
function compoundPosition(uint256 positionId) external returns (uint128) {
    // ...

    // ❌ If fees0 is very large, multiplication could overflow
    uint256 fee0 = (fees0 * config.compoundFee) / 10000;
    uint256 fee1 = (fees1 * config.compoundFee) / 10000;
}

// AFTER (SAFE):
import {FullMath} from "../libraries/FullMath.sol";

function compoundPosition(uint256 positionId) external nonReentrant returns (uint128) {
    Position storage position = positions[positionId];
    PoolConfig memory config = poolConfigs[position.poolId];

    // Validations...

    uint256 fees0 = position.fees0Accumulated;
    uint256 fees1 = position.fees1Accumulated;

    // ✅ Use FullMath for safe multiplication-division
    uint256 fee0 = FullMath.mulDiv(fees0, config.compoundFee, 10000);
    uint256 fee1 = FullMath.mulDiv(fees1, config.compoundFee, 10000);

    // Check for overflow before subtraction
    require(fees0 >= fee0, "Fee calculation overflow");
    require(fees1 >= fee1, "Fee calculation overflow");

    uint256 amount0ToCompound = fees0 - fee0;
    uint256 amount1ToCompound = fees1 - fee1;

    // Calculate liquidity safely
    liquidityAdded = _calculateLiquiditySafe(amount0ToCompound, amount1ToCompound);

    // ... rest of implementation
}

function _calculateLiquiditySafe(uint256 amount0, uint256 amount1)
    internal
    pure
    returns (uint128 liquidity)
{
    // Add bounds check
    require(amount0 <= type(uint128).max, "Amount0 too large");
    require(amount1 <= type(uint128).max, "Amount1 too large");

    // Safe calculation
    liquidity = uint128((amount0 + amount1) / 2);
}
```

---

## Implementation Checklist

### Phase 1: Blocker Fixes (24-48 hours)

- [ ] **LimitOrderHook**: Implement token transfers
  - [ ] `placeOrder()` - Transfer tokens from user
  - [ ] `cancelOrder()` - Return unfilled tokens
  - [ ] `claimOrder()` - Transfer filled tokens
  - [ ] Add `poolKeyStorage` mapping
  - [ ] Add tests for all transfer scenarios

- [ ] **TWAPOrderHook**: Implement swap execution
  - [ ] `executeTWAPOrder()` - Execute actual swap via PoolManager
  - [ ] Calculate proper slippage
  - [ ] Transfer output tokens to order owner
  - [ ] Add tests for swap execution

- [ ] **AutoCompoundHook**: Implement compounding
  - [ ] `compoundPosition()` - Execute actual liquidity addition
  - [ ] Calculate liquidity correctly
  - [ ] Update pool state
  - [ ] Add tests for compound execution

- [ ] **All Hooks**: Add ReentrancyGuard
  - [ ] Import OpenZeppelin ReentrancyGuard
  - [ ] Inherit in all hook contracts
  - [ ] Add `nonReentrant` modifier to all state-changing functions
  - [ ] Test reentrancy attack scenarios

- [ ] **SwapRouter & PositionManager**: Fix ETH transfers
  - [ ] Import `Address` from OpenZeppelin
  - [ ] Replace `call{value}` with `Address.sendValue`
  - [ ] Test with contract recipients
  - [ ] Test gas limits

### Phase 2: Critical Fixes (1-2 weeks)

- [ ] **Access Control**: Implement timelock/multi-sig
  - [ ] Deploy TimelockController (testnet)
  - [ ] Set 2-day delay for parameter changes
  - [ ] Transfer ownership to timelock
  - [ ] Document admin procedures

- [ ] **Slippage Protection**: Use proper calculations
  - [ ] Implement `_executeOrderSwap` in LimitOrderHook
  - [ ] Use `SwapMath.computeSwapStep` for quotes
  - [ ] Verify against `amountOutMinimum`
  - [ ] Add slippage tests

- [ ] **Fee Calculations**: Use FullMath
  - [ ] Replace all `(a * b) / c` with `FullMath.mulDiv(a, b, c)`
  - [ ] Add overflow tests
  - [ ] Verify with max uint256 values

- [ ] **Emergency Controls**: Add pause mechanism
  - [ ] Inherit Pausable from OpenZeppelin
  - [ ] Add `whenNotPaused` modifiers
  - [ ] Implement emergency pause function
  - [ ] Test pause scenarios

### Phase 3: Testing (Parallel with fixes)

- [ ] **Unit Tests**: Achieve 100% coverage
  - [ ] Token transfer tests
  - [ ] Reentrancy attack tests
  - [ ] Slippage tests
  - [ ] Fee overflow tests
  - [ ] Access control tests

- [ ] **Integration Tests**: Multi-contract scenarios
  - [ ] Order placement + execution flow
  - [ ] TWAP execution across multiple intervals
  - [ ] Auto-compound with real swaps
  - [ ] Emergency pause scenarios

- [ ] **Fuzzing Tests**: Property-based testing
  - [ ] Echidna invariant tests
  - [ ] Foundry fuzzing with random inputs
  - [ ] Slither static analysis
  - [ ] Mythril symbolic execution

### Phase 4: Documentation & Audit Prep

- [ ] **Code Documentation**
  - [ ] Complete NatSpec for all functions
  - [ ] Document all assumptions
  - [ ] Add inline comments for complex logic
  - [ ] Update README with security considerations

- [ ] **Security Documentation**
  - [ ] Threat model document
  - [ ] Known limitations
  - [ ] Admin procedures
  - [ ] Incident response plan

- [ ] **Audit Preparation**
  - [ ] Run all automated tools
  - [ ] Fix all HIGH/MEDIUM findings
  - [ ] Prepare audit materials
  - [ ] Schedule external audit

---

## Verification Commands

### After Each Fix, Run:

```bash
# 1. Compile
forge build

# 2. Run tests
forge test -vvv

# 3. Check coverage
forge coverage

# 4. Run static analysis
slither . --exclude-dependencies

# 5. Run gas snapshot
forge snapshot

# 6. Format code
forge fmt

# 7. Run security checks
mythril analyze src/**/*.sol --execution-timeout 300
```

### Before Each Commit:

```bash
# Pre-commit checks
forge test && forge fmt --check && slither .
```

---

## Risk Acceptance (DO NOT USE IN PRODUCTION)

If deploying to **TESTNET ONLY** before fixes:

```solidity
// Add prominent warnings
contract TWAPOrderHook is BaseHook {
    /// @custom:security-note TESTNET ONLY - NOT PRODUCTION READY
    /// @custom:security-note Missing token transfers - orders are simulated
    /// @custom:security-note No reentrancy protection
    /// @dev DO NOT USE ON MAINNET

    bool public constant IS_TESTNET_ONLY = true;

    constructor(address _poolManager) {
        require(block.chainid == 84532, "Base Sepolia only"); // Base Sepolia
        // ...
    }
}
```

---

## Contact for Security Issues

**Internal**: CTO + Lead Architect + Solidity Researcher
**External**: security@basebook.dev (DO NOT public disclose)

---

**Status**: 🚨 REQUIRES IMMEDIATE ATTENTION
**Timeline**: 2-4 weeks to production-ready
**Next Review**: After Phase 1 completion

