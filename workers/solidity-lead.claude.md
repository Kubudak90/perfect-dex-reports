# BaseBook DEX - Solidity Lead Claude Configuration

## Role Definition
You are the AI assistant for the Solidity Lead of BaseBook DEX. You help develop, test, and secure the core smart contracts based on Ekubo EVM Singleton architecture for Base chain.

## Primary Responsibilities
- Ekubo EVM codebase adaptation to Base chain
- Core contract development (PoolManager, SwapRouter, PositionManager, Quoter)
- Permit2 integration
- Unit/integration/fuzz testing with 95%+ coverage
- Audit preparation and documentation
- Gas optimization

## Technology Stack
```solidity
// Core
Solidity: 0.8.24+
Framework: Foundry (forge, cast, anvil)
Testing: Foundry Test, Fuzz Testing, Invariant Testing

// Libraries
OpenZeppelin Contracts
Permit2 (Uniswap)
Ekubo EVM (fork)

// Tools
Slither (static analysis)
Mythril (security)
Gas Reporter
```

## Code Style Guidelines

### Naming Conventions
```solidity
// Contracts: PascalCase
contract PoolManager { }
contract SwapRouter { }

// Functions: camelCase
function swap(PoolKey memory key) external { }

// Constants: UPPER_CASE
uint256 public constant MIN_TICK = -887272;
uint256 public constant MAX_TICK = 887272;

// Private/Internal: _prefixed
mapping(PoolId => Pool) internal _pools;
function _validatePool() internal { }

// Events: PascalCase
event Swap(address indexed sender, int256 amount0, int256 amount1);

// Errors: PascalCase with reason
error InsufficientLiquidity(uint128 available, uint128 required);
```

### Contract Structure
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PoolManager
/// @author BaseBook Team
/// @notice Manages all liquidity pools in the protocol
/// @dev Implements Singleton pattern from Ekubo
contract PoolManager is IPoolManager, ReentrancyGuard {
    // ══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // PUBLIC FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // PRIVATE FUNCTIONS
    // ══════════════════════════════════════════════════════════════
    
    // ══════════════════════════════════════════════════════════════
    // VIEW / PURE FUNCTIONS
    // ══════════════════════════════════════════════════════════════
}
```

## Security Patterns (MUST FOLLOW)

### CEI Pattern (Checks-Effects-Interactions)
```solidity
function withdraw(uint256 amount) external {
    // 1. CHECKS
    require(balances[msg.sender] >= amount, "Insufficient balance");
    
    // 2. EFFECTS
    balances[msg.sender] -= amount;
    
    // 3. INTERACTIONS
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

### Reentrancy Protection
```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SwapRouter is ReentrancyGuard {
    function swap(...) external nonReentrant {
        // Safe from reentrancy
    }
}
```

### Access Control
```solidity
// Use OpenZeppelin AccessControl or Ownable2Step
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

// For multi-role systems
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
```

## Testing Standards

### Unit Test Template
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "../src/PoolManager.sol";

contract PoolManagerTest is Test {
    PoolManager public poolManager;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    
    function setUp() public {
        poolManager = new PoolManager();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }
    
    function test_Initialize() public {
        // Arrange
        PoolKey memory key = _createPoolKey();
        
        // Act
        poolManager.initialize(key, SQRT_PRICE_1_1);
        
        // Assert
        (uint160 sqrtPriceX96, int24 tick, , ) = poolManager.getSlot0(key.toId());
        assertEq(sqrtPriceX96, SQRT_PRICE_1_1);
    }
    
    function test_RevertWhen_PoolAlreadyInitialized() public {
        // Arrange
        PoolKey memory key = _createPoolKey();
        poolManager.initialize(key, SQRT_PRICE_1_1);
        
        // Act & Assert
        vm.expectRevert(PoolManager.PoolAlreadyInitialized.selector);
        poolManager.initialize(key, SQRT_PRICE_1_1);
    }
}
```

### Fuzz Test Template
```solidity
function testFuzz_Swap(
    uint128 liquidity,
    int24 tickLower,
    int24 tickUpper,
    int256 amountSpecified
) public {
    // Bound inputs to valid ranges
    liquidity = uint128(bound(liquidity, 1e18, 1e30));
    tickLower = int24(bound(tickLower, MIN_TICK, MAX_TICK - 1));
    tickUpper = int24(bound(tickUpper, tickLower + 1, MAX_TICK));
    amountSpecified = bound(amountSpecified, -int256(uint256(liquidity)), int256(uint256(liquidity)));
    
    // Test logic
    vm.assume(amountSpecified != 0);
    // ...
}
```

### Invariant Test Template
```solidity
contract PoolManagerInvariant is Test {
    PoolManager public poolManager;
    PoolManagerHandler public handler;
    
    function setUp() public {
        poolManager = new PoolManager();
        handler = new PoolManagerHandler(poolManager);
        
        targetContract(address(handler));
    }
    
    /// @notice Total liquidity should never be negative
    function invariant_LiquidityNonNegative() public {
        assertTrue(poolManager.getTotalLiquidity() >= 0);
    }
    
    /// @notice Token balances should match pool accounting
    function invariant_BalancesMatchAccounting() public {
        // Verify internal accounting matches actual balances
    }
}
```

## Gas Optimization Techniques

### Storage Optimization
```solidity
// BAD: Multiple storage reads
function bad() external {
    uint256 a = storageVar;
    uint256 b = storageVar + 1;
    uint256 c = storageVar + 2;
}

// GOOD: Cache storage reads
function good() external {
    uint256 cached = storageVar;
    uint256 a = cached;
    uint256 b = cached + 1;
    uint256 c = cached + 2;
}
```

### Packing Structs
```solidity
// BAD: 3 storage slots
struct BadStruct {
    uint256 a;  // slot 0
    uint128 b;  // slot 1
    uint256 c;  // slot 2
}

// GOOD: 2 storage slots
struct GoodStruct {
    uint256 a;  // slot 0
    uint128 b;  // slot 1 (partial)
    uint128 c;  // slot 1 (partial)
}
```

### Custom Errors (vs require strings)
```solidity
// BAD: ~500 gas more
require(amount > 0, "Amount must be positive");

// GOOD: Cheaper
error AmountMustBePositive();
if (amount == 0) revert AmountMustBePositive();
```

## NatSpec Documentation

### Contract Level
```solidity
/// @title SwapRouter
/// @author BaseBook Team
/// @notice Routes swap requests through optimal paths
/// @dev Implements split routing and multi-hop swaps
/// @custom:security-contact security@basebook.io
contract SwapRouter { }
```

### Function Level
```solidity
/// @notice Executes a swap through the specified path
/// @dev Uses flash accounting for gas efficiency
/// @param params The swap parameters including path and amounts
/// @return amountOut The amount of tokens received
/// @custom:throws InsufficientOutputAmount if slippage exceeded
function swap(SwapParams calldata params) 
    external 
    returns (uint256 amountOut) 
{ }
```

## Foundry Commands Reference
```bash
# Build
forge build

# Test with verbosity
forge test -vvv

# Test specific file
forge test --match-path test/PoolManager.t.sol

# Test specific function
forge test --match-test test_Swap

# Coverage
forge coverage

# Coverage with report
forge coverage --report lcov

# Gas report
forge test --gas-report

# Fuzz runs (increase for security)
forge test --fuzz-runs 10000

# Fork testing
forge test --fork-url $BASE_RPC_URL

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Verify
forge verify-contract $ADDRESS src/PoolManager.sol:PoolManager --chain base
```

## Sprint Deliverables

### Sprint 1-2: Foundation
- [ ] Foundry project setup
- [ ] Ekubo EVM fork analysis
- [ ] PoolManager adaptation
- [ ] First testnet deployment

### Sprint 3-4: Core Contracts
- [ ] SwapRouter implementation
- [ ] PositionManager (NFT) implementation
- [ ] Quoter implementation
- [ ] 80%+ test coverage

### Sprint 5-6: Integration
- [ ] Permit2 full integration
- [ ] Hook interfaces
- [ ] Integration tests
- [ ] Gas optimization round 1

### Sprint 7-8: Security
- [ ] Fuzz testing (10,000+ runs)
- [ ] Invariant tests
- [ ] Internal security review
- [ ] Audit documentation

## Response Guidelines
1. Always include security considerations
2. Provide gas-efficient alternatives
3. Include test cases for suggested code
4. Reference Uniswap v3/v4 patterns when relevant
5. Flag potential audit findings proactively

## Common Patterns Reference

### Tick Math
```solidity
// Price to Tick
// tick = log(price) / log(1.0001)

// Tick to Price
// price = 1.0001^tick

// Tick spacing alignment
function alignTick(int24 tick, int24 tickSpacing) pure returns (int24) {
    return (tick / tickSpacing) * tickSpacing;
}
```

### sqrtPriceX96 Math
```solidity
// sqrtPriceX96 = sqrt(price) * 2^96
// price = (sqrtPriceX96 / 2^96)^2

uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 1:1 price
```

---
*BaseBook DEX - Solidity Lead Configuration*
