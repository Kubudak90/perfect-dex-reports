// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./BaseHook.sol";
import {IHooks} from "../interfaces/IHooks.sol";
import {PoolKey} from "../types/PoolKey.sol";
import {IPoolManager} from "../interfaces/IPoolManager.sol";
import {BalanceDelta} from "../types/BalanceDelta.sol";
import {FullMath} from "../libraries/FullMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title MEVProtectionHook
/// @author BaseBook Team (Solidity Researcher)
/// @notice Hook that protects against MEV attacks (sandwich attacks, front-running)
/// @dev Implements multiple layers of protection including transaction frequency limits,
///      slippage monitoring, same-block swap detection, commit-reveal for large swaps,
///      block-number based tracking, and private mempool recommendations
contract MEVProtectionHook is BaseHook, Ownable2Step {
    // ══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════

    error SandwichAttackDetected();
    error TransactionFrequencyExceeded();
    error ExcessiveSlippage();
    error InvalidParameters();
    error PoolNotInitialized();
    error BlockSwapLimitReached();
    error CommitNotFound();
    error CommitNotMatured();
    error CommitExpired();
    error CommitHashMismatch();
    error CommitRevealRequired();
    error SenderSwapLimitPerBlockReached();

    // ══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Maximum swap history entries per pool per block
    uint256 public constant MAX_SWAP_HISTORY = 100;

    /// @notice Maximum swap timestamps tracked per address per pool
    uint256 public constant MAX_SWAP_TIMESTAMPS = 100;

    /// @notice Maximum allowed transactions per address per block
    uint256 public constant DEFAULT_MAX_TX_PER_BLOCK = 2;

    /// @notice Time window for rate limiting (in seconds)
    uint256 public constant RATE_LIMIT_WINDOW = 60; // 1 minute

    /// @notice Maximum transactions in time window
    uint256 public constant MAX_TX_PER_WINDOW = 10;

    /// @notice Maximum allowed slippage (basis points, 1% = 100)
    uint256 public constant DEFAULT_MAX_SLIPPAGE_BPS = 500; // 5%

    /// @notice Minimum time between swaps from same address (seconds)
    uint256 public constant MIN_SWAP_INTERVAL = 3;

    /// @notice Number of blocks that must pass before a commit can be revealed
    uint256 public constant COMMIT_DELAY = 2;

    /// @notice Maximum age (in blocks) for a commit before it expires
    uint256 public constant MAX_COMMIT_AGE = 50;

    /// @notice Default threshold (in absolute amountSpecified) above which commit-reveal is required
    /// @dev Can be configured per pool via commitRevealThreshold mapping
    uint256 public constant DEFAULT_COMMIT_REVEAL_THRESHOLD = 100e18;

    /// @notice Default maximum swaps per block per sender (anti-spam)
    uint256 public constant DEFAULT_MAX_SENDER_SWAPS_PER_BLOCK = 3;

    /// @notice Threshold above which private mempool submission is recommended
    uint256 public constant PRIVATE_MEMPOOL_THRESHOLD = 50e18;

    /// @notice Maximum swap block numbers tracked per address per pool
    uint256 public constant MAX_SWAP_BLOCK_NUMBERS = 100;

    /// @notice Block-based rate limit window (in blocks)
    uint256 public constant RATE_LIMIT_BLOCK_WINDOW = 25;

    /// @notice Maximum swaps within the block window
    uint256 public constant MAX_SWAPS_PER_BLOCK_WINDOW = 10;

    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Pool manager reference
    IPoolManager public immutable poolManager;

    /// @notice Protection enabled/disabled per pool
    mapping(bytes32 => bool) public isProtectionEnabled;

    /// @notice Whitelist for trusted addresses (e.g., routers, aggregators)
    mapping(address => bool) public isWhitelisted;

    /// @notice Track swaps per address per block per pool
    /// @dev poolId => blockNumber => address => swapCount
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public swapsPerBlock;

    /// @notice Track last swap direction per address per pool per block
    /// @dev poolId => blockNumber => address => zeroForOne
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public lastSwapDirection;

    /// @notice Track if address has swapped in current block
    /// @dev poolId => blockNumber => address => hasSwapped
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasSwappedInBlock;

    /// @notice Track swap timestamps for rate limiting
    /// @dev poolId => address => timestamp[]
    mapping(bytes32 => mapping(address => uint256[])) public swapTimestamps;

    /// @notice Track last swap timestamp per address per pool
    /// @dev poolId => address => timestamp
    mapping(bytes32 => mapping(address => uint256)) public lastSwapTime;

    /// @notice Track last swap block number per address per pool
    /// @dev poolId => address => blockNumber
    mapping(bytes32 => mapping(address => uint256)) public lastSwapBlock;

    /// @notice Track pool initialization
    mapping(bytes32 => bool) public isPoolInitialized;

    /// @notice Track previous block swaps for sandwich detection
    /// @dev poolId => blockNumber => SwapInfo[]
    mapping(bytes32 => mapping(uint256 => SwapInfo[])) public blockSwaps;

    /// @notice Configurable max transactions per block per pool
    mapping(bytes32 => uint256) public maxTxPerBlock;

    /// @notice Configurable max slippage per pool (basis points)
    mapping(bytes32 => uint256) public maxSlippageBps;

    /// @notice Commit-reveal storage: sender => commitHash => SwapCommit
    mapping(address => mapping(bytes32 => SwapCommit)) public commits;

    /// @notice Configurable commit-reveal threshold per pool (0 = disabled)
    /// @dev poolId => threshold amount (absolute value of amountSpecified)
    mapping(bytes32 => uint256) public commitRevealThreshold;

    /// @notice Whether commit-reveal is enabled per pool
    mapping(bytes32 => bool) public commitRevealEnabled;

    /// @notice Configurable max sender swaps per block per pool
    /// @dev poolId => max swaps per sender per block
    mapping(bytes32 => uint256) public maxSenderSwapsPerBlock;

    /// @notice Track swap block numbers for block-based rate limiting
    /// @dev poolId => address => blockNumber[]
    mapping(bytes32 => mapping(address => uint256[])) public swapBlockNumbers;

    // ══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ══════════════════════════════════════════════════════════════════════

    struct SwapInfo {
        address sender;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceX96Before;
        uint256 timestamp;
    }

    /// @notice Commit data for the commit-reveal scheme
    struct SwapCommit {
        uint256 commitBlock;
        bool exists;
    }

    // ══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════

    event ProtectionEnabled(bytes32 indexed poolId);
    event ProtectionDisabled(bytes32 indexed poolId);
    event AddressWhitelisted(address indexed account);
    event AddressRemovedFromWhitelist(address indexed account);
    event SandwichAttemptBlocked(bytes32 indexed poolId, address indexed attacker, uint256 blockNumber);
    event HighFrequencyBlocked(bytes32 indexed poolId, address indexed trader, uint256 txCount);
    event ExcessiveSlippageDetected(bytes32 indexed poolId, address indexed trader, uint256 slippageBps);
    event ParametersUpdated(bytes32 indexed poolId, uint256 maxTxPerBlock, uint256 maxSlippageBps);
    event BlockSwapsPruned(bytes32 indexed poolId, uint256 blockNumber, uint256 entriesRemoved);
    event SwapCommitted(address indexed sender, bytes32 indexed commitHash, uint256 commitBlock);
    event SwapRevealed(address indexed sender, bytes32 indexed commitHash, uint256 revealBlock);
    event CommitRevealConfigUpdated(bytes32 indexed poolId, uint256 threshold, bool enabled);
    event LargeSwapDetected(
        bytes32 indexed poolId,
        address indexed sender,
        uint256 amount,
        bool shouldUsePrivateMempool
    );
    event MaxSenderSwapsPerBlockUpdated(bytes32 indexed poolId, uint256 maxSwaps);

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════

    constructor(address _poolManager) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK PERMISSIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Returns the hook permissions
    function getHookPermissions() external pure override returns (Permissions memory) {
        return Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeModifyLiquidity: false,
            afterModifyLiquidity: false,
            beforeSwap: true,
            afterSwap: true
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK IMPLEMENTATIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Called after pool initialization
    /// @dev Enables protection by default for new pools
    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        isPoolInitialized[poolId] = true;
        isProtectionEnabled[poolId] = true;
        maxTxPerBlock[poolId] = DEFAULT_MAX_TX_PER_BLOCK;
        maxSlippageBps[poolId] = DEFAULT_MAX_SLIPPAGE_BPS;
        maxSenderSwapsPerBlock[poolId] = DEFAULT_MAX_SENDER_SWAPS_PER_BLOCK;
        commitRevealThreshold[poolId] = DEFAULT_COMMIT_REVEAL_THRESHOLD;
        // commit-reveal disabled by default; owner can enable per pool
        commitRevealEnabled[poolId] = false;

        emit ProtectionEnabled(poolId);

        return IHooks.afterInitialize.selector;
    }

    /// @notice Called before a swap
    /// @dev Performs all MEV protection checks
    function beforeSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Skip checks for whitelisted addresses
        if (isWhitelisted[sender]) {
            return IHooks.beforeSwap.selector;
        }

        // Only check if protection is enabled
        if (isProtectionEnabled[poolId]) {
            _runProtectionChecks(poolId, sender, params);
            _emitAndRecordSwap(poolId, sender, params);
        }

        return IHooks.beforeSwap.selector;
    }

    /// @dev Runs all MEV protection checks (extracted to reduce stack depth)
    function _runProtectionChecks(bytes32 poolId, address sender, IPoolManager.SwapParams calldata params) internal {
        // 1. Check sandwich attack pattern
        _checkSandwichAttack(poolId, sender, params);

        // 2. Check transaction frequency (same block)
        _checkBlockFrequency(poolId, sender);

        // 3. Check rate limiting (time window)
        _checkRateLimit(poolId, sender);

        // 4. Check minimum time between swaps
        _checkSwapInterval(poolId, sender);

        // 5. Check per-sender block limit (anti-spam)
        _checkSenderBlockLimit(poolId, sender);

        // 6. Check block-based rate window
        _checkBlockRateLimit(poolId, sender);
    }

    /// @dev Emits large swap event and records swap info (extracted to reduce stack depth)
    function _emitAndRecordSwap(bytes32 poolId, address sender, IPoolManager.SwapParams calldata params) internal {
        // Emit large swap warning if applicable
        uint256 absAmount = params.amountSpecified >= 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        if (absAmount >= PRIVATE_MEMPOOL_THRESHOLD) {
            emit LargeSwapDetected(poolId, sender, absAmount, true);
        }

        // Store current price for slippage check in afterSwap
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);

        // Enforce MAX_SWAP_HISTORY to prevent unbounded array growth
        if (blockSwaps[poolId][block.number].length >= MAX_SWAP_HISTORY) {
            revert BlockSwapLimitReached();
        }

        // Store swap info for sandwich detection
        blockSwaps[poolId][block.number].push(SwapInfo({
            sender: sender,
            zeroForOne: params.zeroForOne,
            amountSpecified: params.amountSpecified,
            sqrtPriceX96Before: sqrtPriceX96,
            timestamp: block.timestamp
        }));
    }

    /// @notice Called after a swap
    /// @dev Records swap data and checks slippage
    function afterSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params, BalanceDelta)
        external
        override
        returns (bytes4)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        if (!isPoolInitialized[poolId]) revert PoolNotInitialized();

        // Skip checks for whitelisted addresses
        if (isWhitelisted[sender]) {
            return IHooks.afterSwap.selector;
        }

        if (isProtectionEnabled[poolId]) {
            // Update swap tracking
            swapsPerBlock[poolId][block.number][sender]++;
            lastSwapDirection[poolId][block.number][sender] = params.zeroForOne;
            hasSwappedInBlock[poolId][block.number][sender] = true;
            lastSwapTime[poolId][sender] = block.timestamp;
            lastSwapBlock[poolId][sender] = block.number;

            // Add timestamp to rate limit tracking
            swapTimestamps[poolId][sender].push(block.timestamp);

            // Add block number to block-based rate tracking
            swapBlockNumbers[poolId][sender].push(block.number);

            // Clean old timestamps (keep only last window)
            _cleanOldTimestamps(poolId, sender);

            // Clean old block numbers (keep only last block window)
            _cleanOldBlockNumbers(poolId, sender);

            // Check slippage
            _checkSlippage(poolId, sender);
        }

        return IHooks.afterSwap.selector;
    }

    // ══════════════════════════════════════════════════════════════════════
    // COMMIT-REVEAL SCHEME
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Commit a hash of swap parameters for later reveal
    /// @dev Users commit keccak256(abi.encodePacked(poolId, sender, zeroForOne, amountSpecified, secret))
    /// @param commitHash The hash of the swap parameters plus a secret
    function commitSwap(bytes32 commitHash) external {
        if (commitHash == bytes32(0)) revert InvalidParameters();
        if (commits[msg.sender][commitHash].exists) revert InvalidParameters();

        commits[msg.sender][commitHash] = SwapCommit({
            commitBlock: block.number,
            exists: true
        });

        emit SwapCommitted(msg.sender, commitHash, block.number);
    }

    /// @notice Reveal and validate a previously committed swap
    /// @dev Must be called after COMMIT_DELAY blocks and before MAX_COMMIT_AGE blocks
    /// @param poolId The pool ID
    /// @param zeroForOne The swap direction
    /// @param amountSpecified The swap amount
    /// @param secret The secret used when creating the commit hash
    /// @return commitHash The validated commit hash
    function revealSwap(
        bytes32 poolId,
        bool zeroForOne,
        int256 amountSpecified,
        bytes32 secret
    ) external returns (bytes32 commitHash) {
        commitHash = keccak256(abi.encodePacked(poolId, msg.sender, zeroForOne, amountSpecified, secret));

        SwapCommit storage commit = commits[msg.sender][commitHash];

        if (!commit.exists) revert CommitNotFound();

        // Check that enough blocks have passed (maturity)
        if (block.number < commit.commitBlock + COMMIT_DELAY) revert CommitNotMatured();

        // Check that the commit hasn't expired
        if (block.number > commit.commitBlock + MAX_COMMIT_AGE) revert CommitExpired();

        // Consume the commit (prevent replay)
        delete commits[msg.sender][commitHash];

        emit SwapRevealed(msg.sender, commitHash, block.number);

        return commitHash;
    }

    /// @notice Check if a commit exists and is valid for reveal
    /// @param sender The address that committed
    /// @param commitHash The commit hash to check
    /// @return exists Whether the commit exists
    /// @return mature Whether enough blocks have passed for reveal
    /// @return expired Whether the commit has expired
    function getCommitStatus(address sender, bytes32 commitHash)
        external
        view
        returns (bool exists, bool mature, bool expired)
    {
        SwapCommit memory commit = commits[sender][commitHash];
        exists = commit.exists;
        if (exists) {
            mature = block.number >= commit.commitBlock + COMMIT_DELAY;
            expired = block.number > commit.commitBlock + MAX_COMMIT_AGE;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // INTERNAL PROTECTION CHECKS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Detects sandwich attack patterns
    /// @dev Checks if current swap is sandwiched between two swaps from same address
    function _checkSandwichAttack(bytes32 poolId, address sender, IPoolManager.SwapParams calldata params) internal {
        _checkSameBlockSandwich(poolId, sender, params.zeroForOne);
        _checkCrossBlockSandwich(poolId, sender, params.zeroForOne);
    }

    /// @dev Checks same-block sandwich pattern
    function _checkSameBlockSandwich(bytes32 poolId, address sender, bool zeroForOne) internal {
        uint256 currentBlock = block.number;

        if (hasSwappedInBlock[poolId][currentBlock][sender]) {
            bool previousDirection = lastSwapDirection[poolId][currentBlock][sender];

            if (previousDirection != zeroForOne) {
                emit SandwichAttemptBlocked(poolId, sender, currentBlock);
                revert SandwichAttackDetected();
            }
        }
    }

    /// @dev Checks cross-block sandwich pattern
    function _checkCrossBlockSandwich(bytes32 poolId, address sender, bool zeroForOne) internal {
        uint256 currentBlock = block.number;

        if (currentBlock > 0 && hasSwappedInBlock[poolId][currentBlock - 1][sender]) {
            bool prevBlockDirection = lastSwapDirection[poolId][currentBlock - 1][sender];

            uint256 prevBlockSwapCount = blockSwaps[poolId][currentBlock - 1].length;
            uint256 currentBlockSwapCount = blockSwaps[poolId][currentBlock].length;

            if (prevBlockDirection != zeroForOne &&
                (prevBlockSwapCount > 1 || currentBlockSwapCount > 0)) {
                emit SandwichAttemptBlocked(poolId, sender, currentBlock);
                revert SandwichAttackDetected();
            }
        }
    }

    /// @notice Checks transaction frequency in current block
    function _checkBlockFrequency(bytes32 poolId, address sender) internal {
        uint256 txCount = swapsPerBlock[poolId][block.number][sender];
        uint256 maxTx = maxTxPerBlock[poolId];

        if (txCount >= maxTx) {
            emit HighFrequencyBlocked(poolId, sender, txCount);
            revert TransactionFrequencyExceeded();
        }
    }

    /// @notice Checks transaction rate limit over time window
    function _checkRateLimit(bytes32 poolId, address sender) internal {
        uint256[] memory timestamps = swapTimestamps[poolId][sender];
        uint256 recentCount = 0;

        // Handle potential underflow
        uint256 windowStart = block.timestamp > RATE_LIMIT_WINDOW
            ? block.timestamp - RATE_LIMIT_WINDOW
            : 0;

        for (uint256 i = timestamps.length; i > 0; i--) {
            if (timestamps[i - 1] >= windowStart) {
                recentCount++;
            } else {
                break; // Timestamps are ordered, so we can stop
            }
        }

        if (recentCount >= MAX_TX_PER_WINDOW) {
            emit HighFrequencyBlocked(poolId, sender, recentCount);
            revert TransactionFrequencyExceeded();
        }
    }

    /// @notice Checks minimum interval between swaps
    function _checkSwapInterval(bytes32 poolId, address sender) internal view {
        uint256 lastSwap = lastSwapTime[poolId][sender];

        if (lastSwap > 0 && block.timestamp >= lastSwap && block.timestamp - lastSwap < MIN_SWAP_INTERVAL) {
            revert TransactionFrequencyExceeded();
        }
    }

    /// @notice Checks per-sender swap limit within a single block (anti-spam)
    /// @dev Uses block.number to track swaps instead of timestamp
    function _checkSenderBlockLimit(bytes32 poolId, address sender) internal view {
        uint256 senderCount = swapsPerBlock[poolId][block.number][sender];
        uint256 maxPerBlock = maxSenderSwapsPerBlock[poolId];

        if (maxPerBlock > 0 && senderCount >= maxPerBlock) {
            revert SenderSwapLimitPerBlockReached();
        }
    }

    /// @notice Checks block-based rate limiting over a window of blocks
    /// @dev Uses block.number instead of block.timestamp for more reliable timing
    function _checkBlockRateLimit(bytes32 poolId, address sender) internal view {
        uint256[] memory blockNums = swapBlockNumbers[poolId][sender];
        uint256 recentCount = 0;

        uint256 windowStart = block.number > RATE_LIMIT_BLOCK_WINDOW
            ? block.number - RATE_LIMIT_BLOCK_WINDOW
            : 0;

        for (uint256 i = blockNums.length; i > 0; i--) {
            if (blockNums[i - 1] >= windowStart) {
                recentCount++;
            } else {
                break; // Block numbers are ordered, so we can stop
            }
        }

        if (recentCount >= MAX_SWAPS_PER_BLOCK_WINDOW) {
            revert TransactionFrequencyExceeded();
        }
    }

    /// @notice Checks for excessive slippage
    function _checkSlippage(bytes32 poolId, address sender) internal {
        uint160 priceBefore = _findSenderPriceBefore(poolId, sender);
        if (priceBefore == 0) return;

        (uint160 currentPrice,,,) = poolManager.getSlot0(poolId);
        uint256 slippageBps = _calculateSlippageBps(priceBefore, currentPrice);
        uint256 maxSlippage = maxSlippageBps[poolId];

        if (slippageBps > maxSlippage) {
            emit ExcessiveSlippageDetected(poolId, sender, slippageBps);
            revert ExcessiveSlippage();
        }
    }

    /// @dev Finds the sender's most recent swap price before the current swap
    function _findSenderPriceBefore(bytes32 poolId, address sender) internal view returns (uint160) {
        SwapInfo[] memory currentSwaps = blockSwaps[poolId][block.number];
        if (currentSwaps.length == 0) return 0;

        for (uint256 i = currentSwaps.length; i > 0; i--) {
            if (currentSwaps[i - 1].sender == sender) {
                return currentSwaps[i - 1].sqrtPriceX96Before;
            }
        }

        return 0;
    }

    /// @notice Calculates slippage in basis points
    function _calculateSlippageBps(uint160 priceBefore, uint160 priceAfter) internal pure returns (uint256) {
        if (priceBefore == 0) return 0;

        uint256 absChange;
        if (priceAfter > priceBefore) {
            absChange = uint256(priceAfter - priceBefore);
        } else {
            absChange = uint256(priceBefore - priceAfter);
        }

        // Calculate percentage change in basis points
        // (change / priceBefore) * 10000
        return FullMath.mulDiv(absChange, 10000, priceBefore);
    }

    /// @notice Cleans old timestamps outside the rate limit window
    /// @dev Also enforces MAX_SWAP_TIMESTAMPS to prevent unbounded growth
    function _cleanOldTimestamps(bytes32 poolId, address sender) internal {
        uint256[] storage timestamps = swapTimestamps[poolId][sender];

        // Handle potential underflow
        uint256 windowStart = block.timestamp > RATE_LIMIT_WINDOW
            ? block.timestamp - RATE_LIMIT_WINDOW
            : 0;

        uint256 validCount = 0;

        // Count valid timestamps
        for (uint256 i = timestamps.length; i > 0; i--) {
            if (timestamps[i - 1] >= windowStart) {
                validCount++;
            } else {
                break;
            }
        }

        // Cap to MAX_SWAP_TIMESTAMPS (keep only most recent)
        if (validCount > MAX_SWAP_TIMESTAMPS) {
            validCount = MAX_SWAP_TIMESTAMPS;
        }

        // If we need to clean, create new array
        if (validCount < timestamps.length) {
            uint256[] memory newTimestamps = new uint256[](validCount);
            uint256 startIndex = timestamps.length - validCount;

            for (uint256 i = 0; i < validCount; i++) {
                newTimestamps[i] = timestamps[startIndex + i];
            }

            // Clear and repopulate
            delete swapTimestamps[poolId][sender];
            for (uint256 i = 0; i < validCount; i++) {
                swapTimestamps[poolId][sender].push(newTimestamps[i]);
            }
        }
    }

    /// @notice Cleans old block numbers outside the block rate limit window
    /// @dev Also enforces MAX_SWAP_BLOCK_NUMBERS to prevent unbounded growth
    function _cleanOldBlockNumbers(bytes32 poolId, address sender) internal {
        uint256[] storage blockNums = swapBlockNumbers[poolId][sender];

        uint256 windowStart = block.number > RATE_LIMIT_BLOCK_WINDOW
            ? block.number - RATE_LIMIT_BLOCK_WINDOW
            : 0;

        uint256 validCount = 0;

        // Count valid block numbers
        for (uint256 i = blockNums.length; i > 0; i--) {
            if (blockNums[i - 1] >= windowStart) {
                validCount++;
            } else {
                break;
            }
        }

        // Cap to MAX_SWAP_BLOCK_NUMBERS (keep only most recent)
        if (validCount > MAX_SWAP_BLOCK_NUMBERS) {
            validCount = MAX_SWAP_BLOCK_NUMBERS;
        }

        // If we need to clean, create new array
        if (validCount < blockNums.length) {
            uint256[] memory newBlockNums = new uint256[](validCount);
            uint256 startIndex = blockNums.length - validCount;

            for (uint256 i = 0; i < validCount; i++) {
                newBlockNums[i] = blockNums[startIndex + i];
            }

            // Clear and repopulate
            delete swapBlockNumbers[poolId][sender];
            for (uint256 i = 0; i < validCount; i++) {
                swapBlockNumbers[poolId][sender].push(newBlockNums[i]);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Enable MEV protection for a pool
    function enableProtection(bytes32 poolId) external onlyOwner {
        isProtectionEnabled[poolId] = true;
        emit ProtectionEnabled(poolId);
    }

    /// @notice Disable MEV protection for a pool
    function disableProtection(bytes32 poolId) external onlyOwner {
        isProtectionEnabled[poolId] = false;
        emit ProtectionDisabled(poolId);
    }

    /// @notice Add address to whitelist
    function addToWhitelist(address account) external onlyOwner {
        if (account == address(0)) revert InvalidParameters();

        isWhitelisted[account] = true;
        emit AddressWhitelisted(account);
    }

    /// @notice Remove address from whitelist
    function removeFromWhitelist(address account) external onlyOwner {
        isWhitelisted[account] = false;
        emit AddressRemovedFromWhitelist(account);
    }

    /// @notice Update protection parameters for a pool
    function updateParameters(bytes32 poolId, uint256 _maxTxPerBlock, uint256 _maxSlippageBps) external onlyOwner {
        if (_maxTxPerBlock == 0 || _maxSlippageBps == 0) revert InvalidParameters();

        maxTxPerBlock[poolId] = _maxTxPerBlock;
        maxSlippageBps[poolId] = _maxSlippageBps;

        emit ParametersUpdated(poolId, _maxTxPerBlock, _maxSlippageBps);
    }

    /// @notice Update commit-reveal threshold and enable/disable for a pool
    /// @param poolId The pool to configure
    /// @param threshold The swap amount threshold above which commit-reveal is required (0 = use default)
    /// @param enabled Whether commit-reveal is enabled for this pool
    function updateCommitRevealConfig(bytes32 poolId, uint256 threshold, bool enabled) external onlyOwner {
        commitRevealThreshold[poolId] = threshold;
        commitRevealEnabled[poolId] = enabled;

        emit CommitRevealConfigUpdated(poolId, threshold, enabled);
    }

    /// @notice Update max sender swaps per block for a pool
    /// @param poolId The pool to configure
    /// @param maxSwaps The max swaps per sender per block (0 = disabled)
    function updateMaxSenderSwapsPerBlock(bytes32 poolId, uint256 maxSwaps) external onlyOwner {
        maxSenderSwapsPerBlock[poolId] = maxSwaps;

        emit MaxSenderSwapsPerBlockUpdated(poolId, maxSwaps);
    }

    /// @notice Prune old block swap entries to free storage
    /// @dev Can be called by anyone to clean up old block data
    /// @param poolId The pool to prune
    /// @param blockNumber The block number whose swap history to prune (must be in the past)
    function pruneBlockSwaps(bytes32 poolId, uint256 blockNumber) external {
        if (blockNumber >= block.number) revert InvalidParameters();

        uint256 entriesRemoved = blockSwaps[poolId][blockNumber].length;
        delete blockSwaps[poolId][blockNumber];

        emit BlockSwapsPruned(poolId, blockNumber, entriesRemoved);
    }

    /// @notice Get the number of block swap entries for a pool/block
    function getBlockSwapCount(bytes32 poolId, uint256 blockNumber) external view returns (uint256) {
        return blockSwaps[poolId][blockNumber].length;
    }

    // ══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Check if an address can swap (for frontend validation)
    function canSwap(bytes32 poolId, address sender) external view returns (bool, string memory) {
        if (!isProtectionEnabled[poolId]) {
            return (true, "Protection disabled");
        }

        if (isWhitelisted[sender]) {
            return (true, "Whitelisted");
        }

        // Check block frequency
        if (swapsPerBlock[poolId][block.number][sender] >= maxTxPerBlock[poolId]) {
            return (false, "Block frequency limit exceeded");
        }

        // Check swap interval
        if (!_checkSwapIntervalView(poolId, sender)) {
            return (false, "Minimum swap interval not met");
        }

        // Check rate limit
        if (_isRateLimitExceeded(poolId, sender)) {
            return (false, "Rate limit exceeded");
        }

        // Check sender block limit
        if (_isSenderBlockLimitExceeded(poolId, sender)) {
            return (false, "Sender swap limit per block reached");
        }

        return (true, "OK");
    }

    /// @dev Internal view helper: checks if swap interval is satisfied
    function _checkSwapIntervalView(bytes32 poolId, address sender) internal view returns (bool) {
        uint256 lastSwap = lastSwapTime[poolId][sender];
        if (lastSwap > 0 && block.timestamp >= lastSwap && block.timestamp - lastSwap < MIN_SWAP_INTERVAL) {
            return false;
        }
        return true;
    }

    /// @dev Internal view helper: checks if rate limit is exceeded
    function _isRateLimitExceeded(bytes32 poolId, address sender) internal view returns (bool) {
        uint256[] memory timestamps = swapTimestamps[poolId][sender];
        uint256 recentCount = 0;
        uint256 windowStart = block.timestamp > RATE_LIMIT_WINDOW
            ? block.timestamp - RATE_LIMIT_WINDOW
            : 0;

        for (uint256 i = timestamps.length; i > 0; i--) {
            if (timestamps[i - 1] >= windowStart) {
                recentCount++;
            } else {
                break;
            }
        }

        return recentCount >= MAX_TX_PER_WINDOW;
    }

    /// @dev Internal view helper: checks if sender block limit is exceeded
    function _isSenderBlockLimitExceeded(bytes32 poolId, address sender) internal view returns (bool) {
        uint256 maxPerBlock = maxSenderSwapsPerBlock[poolId];
        return maxPerBlock > 0 && swapsPerBlock[poolId][block.number][sender] >= maxPerBlock;
    }

    /// @notice Get swap count for address in current block
    function getSwapCount(bytes32 poolId, address sender) external view returns (uint256) {
        return swapsPerBlock[poolId][block.number][sender];
    }

    /// @notice Get recent swap timestamps for an address
    function getRecentSwaps(bytes32 poolId, address sender) external view returns (uint256[] memory) {
        return swapTimestamps[poolId][sender];
    }

    /// @notice Get recent swap block numbers for an address
    function getRecentSwapBlocks(bytes32 poolId, address sender) external view returns (uint256[] memory) {
        return swapBlockNumbers[poolId][sender];
    }

    /// @notice Get pool protection parameters
    function getPoolParameters(bytes32 poolId) external view returns (
        bool protectionEnabled,
        uint256 _maxTxPerBlock,
        uint256 _maxSlippageBps
    ) {
        return (
            isProtectionEnabled[poolId],
            maxTxPerBlock[poolId],
            maxSlippageBps[poolId]
        );
    }

    /// @notice Returns recommended submission method based on swap amount
    /// @dev Helps frontends decide whether to use Flashbots/private mempool
    /// @param swapAmount The absolute amount of the swap
    /// @return usePrivateMempool Whether the swap should be submitted via private mempool
    /// @return reason Human-readable reason for the recommendation
    function getRecommendedSubmissionMethod(uint256 swapAmount)
        external
        pure
        returns (bool usePrivateMempool, string memory reason)
    {
        if (swapAmount >= PRIVATE_MEMPOOL_THRESHOLD) {
            return (true, "Large swap: use Flashbots Protect or private mempool to avoid frontrunning");
        }

        return (false, "Standard submission is acceptable for this swap size");
    }

    /// @notice Get the last swap block number for an address in a pool
    function getLastSwapBlock(bytes32 poolId, address sender) external view returns (uint256) {
        return lastSwapBlock[poolId][sender];
    }
}
