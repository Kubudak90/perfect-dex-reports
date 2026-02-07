// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {TimelockAdmin} from "../../src/core/TimelockAdmin.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {PoolManager} from "../../src/core/PoolManager.sol";
import {DynamicFeeHook} from "../../src/hooks/DynamicFeeHook.sol";
import {OracleHook} from "../../src/hooks/OracleHook.sol";
import {LimitOrderHook} from "../../src/hooks/LimitOrderHook.sol";
import {MEVProtectionHook} from "../../src/hooks/MEVProtectionHook.sol";
import {TWAPOrderHook} from "../../src/hooks/TWAPOrderHook.sol";
import {AutoCompoundHook} from "../../src/hooks/AutoCompoundHook.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title TimelockAdminTest
/// @notice Tests for TimelockAdmin deployment, admin function access control, and Ownable2Step transfers
contract TimelockAdminTest is Test {
    // ══════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════

    TimelockAdmin public timelockAdmin;
    PoolManager public poolManager;
    DynamicFeeHook public dynamicFeeHook;
    OracleHook public oracleHook;
    LimitOrderHook public limitOrderHook;
    MEVProtectionHook public mevProtectionHook;
    TWAPOrderHook public twapOrderHook;
    AutoCompoundHook public autoCompoundHook;

    address public deployer = address(this);
    address public multisig = makeAddr("multisig");
    address public attacker = makeAddr("attacker");
    address public user = makeAddr("user");

    uint256 constant TIMELOCK_DELAY = 86400; // 24 hours

    // ══════════════════════════════════════════════════════════════════════
    // SETUP
    // ══════════════════════════════════════════════════════════════════════

    function setUp() public {
        // Deploy PoolManager
        poolManager = new PoolManager();

        // Deploy all hooks
        dynamicFeeHook = new DynamicFeeHook(address(poolManager));
        oracleHook = new OracleHook(address(poolManager));
        limitOrderHook = new LimitOrderHook(address(poolManager));
        mevProtectionHook = new MEVProtectionHook(address(poolManager));
        twapOrderHook = new TWAPOrderHook(address(poolManager));
        autoCompoundHook = new AutoCompoundHook(address(poolManager));

        // Deploy TimelockAdmin with multisig as proposer and executor
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;
        address[] memory executors = new address[](1);
        executors[0] = multisig;

        timelockAdmin = new TimelockAdmin(TIMELOCK_DELAY, proposers, executors, address(0));
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIMELOCK DEPLOYMENT TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_TimelockDeployment() public view {
        assertEq(timelockAdmin.getMinDelay(), TIMELOCK_DELAY);
        assertTrue(timelockAdmin.hasRole(timelockAdmin.PROPOSER_ROLE(), multisig));
        assertTrue(timelockAdmin.hasRole(timelockAdmin.EXECUTOR_ROLE(), multisig));
        assertTrue(timelockAdmin.hasRole(timelockAdmin.CANCELLER_ROLE(), multisig));
        // Self-administration
        assertTrue(timelockAdmin.hasRole(timelockAdmin.DEFAULT_ADMIN_ROLE(), address(timelockAdmin)));
    }

    function test_TimelockDeployment_RevertsBelowMinDelay() public {
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;
        address[] memory executors = new address[](1);
        executors[0] = multisig;

        vm.expectRevert(
            abi.encodeWithSelector(TimelockAdmin.DelayBelowMinimum.selector, 3600, 86400)
        );
        new TimelockAdmin(3600, proposers, executors, address(0));
    }

    function test_TimelockDeployment_ExactMinDelay() public {
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;
        address[] memory executors = new address[](1);
        executors[0] = multisig;

        TimelockAdmin tl = new TimelockAdmin(86400, proposers, executors, address(0));
        assertEq(tl.getMinDelay(), 86400);
    }

    function test_TimelockDeployment_LargerDelay() public {
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;
        address[] memory executors = new address[](1);
        executors[0] = multisig;

        TimelockAdmin tl = new TimelockAdmin(172800, proposers, executors, address(0)); // 48 hours
        assertEq(tl.getMinDelay(), 172800);
    }

    function test_TimelockRoles() public view {
        // Attacker should not have any roles
        assertFalse(timelockAdmin.hasRole(timelockAdmin.PROPOSER_ROLE(), attacker));
        assertFalse(timelockAdmin.hasRole(timelockAdmin.EXECUTOR_ROLE(), attacker));
        assertFalse(timelockAdmin.hasRole(timelockAdmin.CANCELLER_ROLE(), attacker));
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIMELOCK OPERATION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_TimelockScheduleAndExecute() public {
        // Transfer PoolManager ownership to timelockAdmin
        poolManager.transferOwnership(address(timelockAdmin));

        // Now schedule a pause operation via timelock
        bytes memory pauseCalldata = abi.encodeWithSignature("pause()");
        bytes32 predecessor = bytes32(0);
        bytes32 salt = keccak256("pause-pool-manager");

        // Schedule as multisig
        vm.prank(multisig);
        timelockAdmin.schedule(
            address(poolManager),
            0,
            pauseCalldata,
            predecessor,
            salt,
            TIMELOCK_DELAY
        );

        // Get the operation ID
        bytes32 operationId = timelockAdmin.hashOperation(
            address(poolManager), 0, pauseCalldata, predecessor, salt
        );

        // Verify it's pending
        assertTrue(timelockAdmin.isOperationPending(operationId));
        assertFalse(timelockAdmin.isOperationReady(operationId));

        // Try to execute immediately (should fail)
        vm.prank(multisig);
        vm.expectRevert();
        timelockAdmin.execute(address(poolManager), 0, pauseCalldata, predecessor, salt);

        // Warp time past the delay
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        // Now it should be ready
        assertTrue(timelockAdmin.isOperationReady(operationId));

        // Execute as multisig
        vm.prank(multisig);
        timelockAdmin.execute(address(poolManager), 0, pauseCalldata, predecessor, salt);

        // Verify it was executed
        assertTrue(timelockAdmin.isOperationDone(operationId));
        assertTrue(poolManager.paused());
    }

    function test_TimelockSchedule_RevertsForNonProposer() public {
        bytes memory data = abi.encodeWithSignature("pause()");

        vm.prank(attacker);
        vm.expectRevert();
        timelockAdmin.schedule(address(poolManager), 0, data, bytes32(0), bytes32(0), TIMELOCK_DELAY);
    }

    function test_TimelockExecute_RevertsForNonExecutor() public {
        poolManager.transferOwnership(address(timelockAdmin));

        bytes memory data = abi.encodeWithSignature("pause()");
        bytes32 salt = keccak256("pause-test");

        vm.prank(multisig);
        timelockAdmin.schedule(address(poolManager), 0, data, bytes32(0), salt, TIMELOCK_DELAY);

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.prank(attacker);
        vm.expectRevert();
        timelockAdmin.execute(address(poolManager), 0, data, bytes32(0), salt);
    }

    function test_TimelockCancel() public {
        bytes memory data = abi.encodeWithSignature("pause()");
        bytes32 salt = keccak256("cancel-test");

        vm.prank(multisig);
        timelockAdmin.schedule(address(poolManager), 0, data, bytes32(0), salt, TIMELOCK_DELAY);

        bytes32 operationId = timelockAdmin.hashOperation(
            address(poolManager), 0, data, bytes32(0), salt
        );

        assertTrue(timelockAdmin.isOperationPending(operationId));

        // Cancel as multisig (has CANCELLER_ROLE)
        vm.prank(multisig);
        timelockAdmin.cancel(operationId);

        assertFalse(timelockAdmin.isOperationPending(operationId));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS VIA TIMELOCK TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_AdminFunctionViaMEVProtection_EnableProtection() public {
        // Transfer MEVProtectionHook ownership to timelockAdmin
        mevProtectionHook.transferOwnership(address(timelockAdmin));

        // TimelockAdmin needs to accept ownership (2-step)
        // Schedule the acceptOwnership call
        bytes memory acceptCalldata = abi.encodeWithSignature("acceptOwnership()");
        bytes32 salt = keccak256("accept-mev-ownership");

        vm.prank(multisig);
        timelockAdmin.schedule(
            address(mevProtectionHook), 0, acceptCalldata, bytes32(0), salt, TIMELOCK_DELAY
        );

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.prank(multisig);
        timelockAdmin.execute(
            address(mevProtectionHook), 0, acceptCalldata, bytes32(0), salt
        );

        assertEq(mevProtectionHook.owner(), address(timelockAdmin));

        // Now try to call enableProtection directly (should fail - not owner)
        bytes32 poolId = keccak256("test-pool");
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.enableProtection(poolId);

        // Schedule enableProtection via timelock
        bytes memory enableData = abi.encodeWithSelector(
            mevProtectionHook.enableProtection.selector, poolId
        );
        bytes32 salt2 = keccak256("enable-protection");

        vm.prank(multisig);
        timelockAdmin.schedule(
            address(mevProtectionHook), 0, enableData, bytes32(0), salt2, TIMELOCK_DELAY
        );

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.prank(multisig);
        timelockAdmin.execute(
            address(mevProtectionHook), 0, enableData, bytes32(0), salt2
        );

        assertTrue(mevProtectionHook.isProtectionEnabled(poolId));
    }

    function test_AdminFunctionViaAutoCompound_SetFeeCollector() public {
        // Transfer ownership to timelock
        autoCompoundHook.transferOwnership(address(timelockAdmin));

        // Accept ownership via timelock
        bytes memory acceptCalldata = abi.encodeWithSignature("acceptOwnership()");
        bytes32 salt = keccak256("accept-autocompound-ownership");

        vm.prank(multisig);
        timelockAdmin.schedule(
            address(autoCompoundHook), 0, acceptCalldata, bytes32(0), salt, TIMELOCK_DELAY
        );

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.prank(multisig);
        timelockAdmin.execute(
            address(autoCompoundHook), 0, acceptCalldata, bytes32(0), salt
        );

        assertEq(autoCompoundHook.owner(), address(timelockAdmin));

        // Schedule setFeeCollector via timelock
        address newCollector = makeAddr("newCollector");
        bytes memory setCollectorData = abi.encodeWithSelector(
            autoCompoundHook.setFeeCollector.selector, newCollector
        );
        bytes32 salt2 = keccak256("set-fee-collector");

        vm.prank(multisig);
        timelockAdmin.schedule(
            address(autoCompoundHook), 0, setCollectorData, bytes32(0), salt2, TIMELOCK_DELAY
        );

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        vm.prank(multisig);
        timelockAdmin.execute(
            address(autoCompoundHook), 0, setCollectorData, bytes32(0), salt2
        );

        assertEq(autoCompoundHook.feeCollector(), newCollector);
    }

    // ══════════════════════════════════════════════════════════════════════
    // OWNABLE2STEP TESTS FOR EACH HOOK
    // ══════════════════════════════════════════════════════════════════════

    function test_DynamicFeeHook_Ownable2Step() public {
        // Initial owner is deployer (this contract)
        assertEq(dynamicFeeHook.owner(), deployer);

        // Step 1: Propose transfer
        dynamicFeeHook.transferOwnership(user);
        assertEq(dynamicFeeHook.pendingOwner(), user);
        // Owner hasn't changed yet
        assertEq(dynamicFeeHook.owner(), deployer);

        // Step 2: User accepts
        vm.prank(user);
        dynamicFeeHook.acceptOwnership();
        assertEq(dynamicFeeHook.owner(), user);
        assertEq(dynamicFeeHook.pendingOwner(), address(0));
    }

    function test_OracleHook_Ownable2Step() public {
        assertEq(oracleHook.owner(), deployer);

        oracleHook.transferOwnership(user);
        assertEq(oracleHook.pendingOwner(), user);
        assertEq(oracleHook.owner(), deployer);

        vm.prank(user);
        oracleHook.acceptOwnership();
        assertEq(oracleHook.owner(), user);
    }

    function test_LimitOrderHook_Ownable2Step() public {
        assertEq(limitOrderHook.owner(), deployer);

        limitOrderHook.transferOwnership(user);
        assertEq(limitOrderHook.pendingOwner(), user);

        vm.prank(user);
        limitOrderHook.acceptOwnership();
        assertEq(limitOrderHook.owner(), user);
    }

    function test_MEVProtectionHook_Ownable2Step() public {
        assertEq(mevProtectionHook.owner(), deployer);

        mevProtectionHook.transferOwnership(user);
        assertEq(mevProtectionHook.pendingOwner(), user);

        vm.prank(user);
        mevProtectionHook.acceptOwnership();
        assertEq(mevProtectionHook.owner(), user);
    }

    function test_TWAPOrderHook_Ownable2Step() public {
        assertEq(twapOrderHook.owner(), deployer);

        twapOrderHook.transferOwnership(user);
        assertEq(twapOrderHook.pendingOwner(), user);

        vm.prank(user);
        twapOrderHook.acceptOwnership();
        assertEq(twapOrderHook.owner(), user);
    }

    function test_AutoCompoundHook_Ownable2Step() public {
        assertEq(autoCompoundHook.owner(), deployer);

        autoCompoundHook.transferOwnership(user);
        assertEq(autoCompoundHook.pendingOwner(), user);

        vm.prank(user);
        autoCompoundHook.acceptOwnership();
        assertEq(autoCompoundHook.owner(), user);
    }

    // ══════════════════════════════════════════════════════════════════════
    // OWNABLE2STEP REJECTION TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_Ownable2Step_WrongAcceptor() public {
        dynamicFeeHook.transferOwnership(user);

        // Attacker cannot accept
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        dynamicFeeHook.acceptOwnership();

        // Owner is unchanged
        assertEq(dynamicFeeHook.owner(), deployer);
    }

    function test_Ownable2Step_NonOwnerCannotTransfer() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        dynamicFeeHook.transferOwnership(attacker);
    }

    function test_Ownable2Step_TransferOverridesPending() public {
        // Propose transfer to user
        dynamicFeeHook.transferOwnership(user);
        assertEq(dynamicFeeHook.pendingOwner(), user);

        // Override with transfer to attacker
        dynamicFeeHook.transferOwnership(attacker);
        assertEq(dynamicFeeHook.pendingOwner(), attacker);

        // User can no longer accept
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        dynamicFeeHook.acceptOwnership();

        // Attacker can accept
        vm.prank(attacker);
        dynamicFeeHook.acceptOwnership();
        assertEq(dynamicFeeHook.owner(), attacker);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTION ACCESS CONTROL TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_OracleHook_IncreaseCardinality_OnlyOwner() public {
        // Non-owner cannot call increaseCardinality
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        oracleHook.increaseCardinality(bytes32(0), 100);
    }

    function test_LimitOrderHook_SetExecutionFee_OnlyOwner() public {
        // Non-owner cannot call setExecutionFee
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        limitOrderHook.setExecutionFee(50);
    }

    function test_LimitOrderHook_SetFeeCollector_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        limitOrderHook.setFeeCollector(attacker);
    }

    function test_MEVProtectionHook_EnableProtection_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.enableProtection(bytes32(0));
    }

    function test_MEVProtectionHook_DisableProtection_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.disableProtection(bytes32(0));
    }

    function test_MEVProtectionHook_AddToWhitelist_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.addToWhitelist(user);
    }

    function test_MEVProtectionHook_RemoveFromWhitelist_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.removeFromWhitelist(user);
    }

    function test_MEVProtectionHook_UpdateParameters_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        mevProtectionHook.updateParameters(bytes32(0), 5, 500);
    }

    function test_TWAPOrderHook_SetFeeCollector_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        twapOrderHook.setFeeCollector(attacker);
    }

    function test_AutoCompoundHook_UpdatePoolConfig_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        autoCompoundHook.updatePoolConfig(bytes32(0), true, 3600, 1e15, 10);
    }

    function test_AutoCompoundHook_SetFeeCollector_OnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        autoCompoundHook.setFeeCollector(attacker);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS WORK FOR OWNER
    // ══════════════════════════════════════════════════════════════════════

    function test_MEVProtectionHook_AdminFunctions_WorkForOwner() public {
        bytes32 poolId = keccak256("test-pool");

        // Enable protection
        mevProtectionHook.enableProtection(poolId);
        assertTrue(mevProtectionHook.isProtectionEnabled(poolId));

        // Disable protection
        mevProtectionHook.disableProtection(poolId);
        assertFalse(mevProtectionHook.isProtectionEnabled(poolId));

        // Whitelist
        mevProtectionHook.addToWhitelist(user);
        assertTrue(mevProtectionHook.isWhitelisted(user));

        mevProtectionHook.removeFromWhitelist(user);
        assertFalse(mevProtectionHook.isWhitelisted(user));

        // Update parameters
        mevProtectionHook.updateParameters(poolId, 5, 1000);
        (,uint256 maxTx, uint256 maxSlip) = mevProtectionHook.getPoolParameters(poolId);
        assertEq(maxTx, 5);
        assertEq(maxSlip, 1000);
    }

    function test_LimitOrderHook_AdminFunctions_WorkForOwner() public {
        limitOrderHook.setExecutionFee(50);
        assertEq(limitOrderHook.executionFee(), 50);

        address newCollector = makeAddr("newCollector");
        limitOrderHook.setFeeCollector(newCollector);
        assertEq(limitOrderHook.feeCollector(), newCollector);
    }

    function test_TWAPOrderHook_AdminFunctions_WorkForOwner() public {
        address newCollector = makeAddr("newCollector");
        twapOrderHook.setFeeCollector(newCollector);
        assertEq(twapOrderHook.feeCollector(), newCollector);
    }

    function test_AutoCompoundHook_AdminFunctions_WorkForOwner() public {
        bytes32 poolId = keccak256("test-pool");
        autoCompoundHook.updatePoolConfig(poolId, false, 7200, 2e15, 50);

        (bool enabled, uint256 interval, uint256 minFees, uint256 fee) = autoCompoundHook.poolConfigs(poolId);
        assertFalse(enabled);
        assertEq(interval, 7200);
        assertEq(minFees, 2e15);
        assertEq(fee, 50);

        address newCollector = makeAddr("newCollector");
        autoCompoundHook.setFeeCollector(newCollector);
        assertEq(autoCompoundHook.feeCollector(), newCollector);
    }

    // ══════════════════════════════════════════════════════════════════════
    // RENOUNCE OWNERSHIP TESTS
    // ══════════════════════════════════════════════════════════════════════

    function test_RenounceOwnership() public {
        dynamicFeeHook.renounceOwnership();
        assertEq(dynamicFeeHook.owner(), address(0));
    }

    function test_RenounceOwnership_NonOwnerCannot() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        dynamicFeeHook.renounceOwnership();
    }
}
