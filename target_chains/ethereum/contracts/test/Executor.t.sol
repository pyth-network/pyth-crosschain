// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "../contracts/executor/ExecutorUpgradable.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/InvalidMagic.t.sol";

contract ExecutorTest is Test, WormholeTestUtils {
    Wormhole public wormhole;
    ExecutorUpgradable public executor;
    ExecutorUpgradable public executor2;
    TestCallable public callable;
    InvalidMagic public executorInvalidMagic;

    uint16 OWNER_CHAIN_ID = 7;
    bytes32 OWNER_EMITTER = bytes32(uint256(1));

    uint8 NUM_SIGNERS = 1;

    function setUp() public {
        address _wormhole = setUpWormholeReceiver(NUM_SIGNERS);
        ExecutorUpgradable _executor = new ExecutorUpgradable();
        ERC1967Proxy _proxy = new ERC1967Proxy(address(_executor), "");
        executor = ExecutorUpgradable(payable(address(_proxy)));
        executor2 = new ExecutorUpgradable();
        executorInvalidMagic = new InvalidMagic();

        executor.initialize(
            _wormhole,
            0,
            CHAIN_ID,
            OWNER_CHAIN_ID,
            OWNER_EMITTER
        );
        callable = new TestCallable();
    }

    function testExecute(
        address callAddress,
        bytes memory callData,
        uint64 sequence,
        uint value
    ) internal returns (bytes memory vaa) {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            callAddress,
            value,
            callData
        );

        vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            sequence,
            payload,
            NUM_SIGNERS
        );

        executor.execute(vaa);
    }

    function getTestUpgradeVaa(
        address newImplementation,
        uint value
    ) internal view returns (bytes memory vaa) {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(executor),
            value,
            abi.encodeWithSelector(
                ExecutorUpgradable.upgradeTo.selector,
                newImplementation
            )
        );

        vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );
    }

    function testExecutorOwnerChainId() public {
        uint chainId = executor.getOwnerChainId();
        assertEq(chainId, OWNER_CHAIN_ID);
    }

    function testExecutorOwnerEmitterAddress() public {
        bytes32 ownerEmitterAddress = executor.getOwnerEmitterAddress();
        assertEq(ownerEmitterAddress, OWNER_EMITTER);
    }

    function testExecutorOwner() public {
        assertEq(address(executor), executor.owner());
    }

    function testExternaUpgradeCallFails() public {
        vm.expectRevert("Ownable: caller is not the owner");
        executor.upgradeTo(address(executor2));
    }

    function testUpgradeCallSucceedsForContractWithCorrectMagic() public {
        bytes memory vaa = getTestUpgradeVaa(address(executor2), 0);
        executor.execute(vaa);
    }

    function testUpgradeCallFailsForNotUUPSContract() public {
        bytes memory vaa = getTestUpgradeVaa(address(callable), 0);

        vm.expectRevert("ERC1967Upgrade: new implementation is not UUPS");
        executor.execute(vaa);
    }

    function testUpgradeCallFailsForInvalidMagic() public {
        bytes memory vaa = getTestUpgradeVaa(address(executorInvalidMagic), 0);

        vm.expectRevert(ExecutorErrors.InvalidMagicValue.selector);
        executor.execute(vaa);
    }

    function testLastExecutedSequenceUpdateOnSucceed() public {
        callable.reset();

        uint32 c = callable.fooCount();
        uint oldSequence = executor.getLastExecutedSequence();
        uint64 sequence = 1;
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            sequence,
            0
        );
        uint newSequence = executor.getLastExecutedSequence();

        assertGt(newSequence, oldSequence);
        assertEq(newSequence, sequence);
        assertEq(callable.fooCount(), c + 1);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testLastExecutedSequenceNoChangeOnFail() public {
        uint oldSequence = executor.getLastExecutedSequence();

        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.reverts.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert("call should revert");
        executor.execute(vaa);
        uint newSequence = executor.getLastExecutedSequence();
        assertEq(newSequence, oldSequence);
    }

    function testCallSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            1,
            0
        );
        assertEq(callable.fooCount(), c + 1);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallWithValueSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));

        uint value = 1;
        vm.deal(address(executor), value);

        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.fooPayable.selector),
            1,
            value
        );
        assertEq(callable.fooCount(), c + 1);
        assertEq(callable.lastCaller(), address(executor));
        assertEq(address(executor).balance, 0);
        assertEq(address(callable).balance, value);
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallWithValueInsufficientBalance() public {
        callable.reset();

        assertEq(callable.lastCaller(), address(bytes20(0)));

        uint value = 5;
        vm.deal(address(executor), 1);

        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            value,
            abi.encodeWithSelector(ICallable.fooPayable.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert();
        executor.execute(vaa);
    }

    function testCallWithArgsSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.fooWithArgs.selector, 17),
            1,
            0
        );
        assertEq(callable.fooCount(), c + 17);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallWithArgsAndValueSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));

        uint value = 1;
        vm.deal(address(executor), value);

        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.fooPayableWithArgs.selector, 17),
            1,
            value
        );
        assertEq(callable.fooCount(), c + 17);
        assertEq(callable.lastCaller(), address(executor));
        assertEq(address(executor).balance, 0);
        assertEq(address(callable).balance, value);
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallerAddress() public {
        uint32 c = callable.fooCount();
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            1,
            0
        );
        assertEq(callable.fooCount(), c + 1);
    }

    function testIncorrectVaa() public {
        string[5] memory forgeItems = [
            "vaaSignature",
            "vaaVersion",
            "vaaGuardianSetIndex",
            "vaaNumSigners+",
            "vaaNumSigners-"
        ];

        for (uint i = 0; i < forgeItems.length; i++) {
            bytes memory payload = abi.encodePacked(
                uint32(0x5054474d),
                PythGovernanceInstructions.GovernanceModule.EvmExecutor,
                Executor.ExecutorAction.Execute,
                CHAIN_ID,
                address(executor),
                address(callable),
                uint(0),
                abi.encodeWithSelector(ICallable.foo.selector)
            );

            bytes memory vaa = forgeVaa(
                uint32(block.timestamp),
                OWNER_CHAIN_ID,
                OWNER_EMITTER,
                1,
                payload,
                NUM_SIGNERS,
                bytes(forgeItems[i])
            );

            // ExecutorErrors.InvalidWormholeVaa.selector
            vm.expectRevert();
            executor.execute(vaa);
        }
    }

    function testIncorrectOwnerEmitterAddress() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            bytes32(uint256(2)),
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.UnauthorizedEmitter.selector);
        executor.execute(vaa);
    }

    function testIncorrectOwnerEmitterChainId() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            8,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.UnauthorizedEmitter.selector);
        executor.execute(vaa);
    }

    function testOutOfOrder() public {
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            3,
            0
        );

        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            3,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.MessageOutOfOrder.selector);
        executor.execute(vaa);

        callable.reset();
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            4,
            0
        );
        assertEq(callable.fooCount(), 1);
    }

    function testInvalidPayload() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory shortPayload = BytesLib.slice(
            payload,
            0,
            payload.length - 1
        );
        bytes memory shortVaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            shortPayload,
            NUM_SIGNERS
        );

        vm.expectRevert();
        executor.execute(shortVaa);
    }

    function testIncorrectTargetChainId() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            uint16(3),
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.InvalidGovernanceTarget.selector);
        executor.execute(vaa);
    }

    function testIncorrectTargetAddress() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(0x1),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.DeserializationError.selector);
        executor.execute(vaa);
    }

    function testIncorrectAction() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            uint8(17),
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert();
        executor.execute(vaa);
    }

    function testCallReverts() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
            uint(0),
            abi.encodeWithSelector(ICallable.reverts.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert("call should revert");
        executor.execute(vaa);
    }

    function testCallToEoaReverts() public {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(100),
            uint(0),
            abi.encodeWithSelector(ICallable.foo.selector)
        );

        bytes memory vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            1,
            payload,
            NUM_SIGNERS
        );

        vm.expectRevert(ExecutorErrors.InvalidContractTarget.selector);
        executor.execute(vaa);
    }
}

interface ICallable {
    function foo() external;

    function fooPayable() external payable;

    function fooWithArgs(uint32 inc) external;

    function fooPayableWithArgs(uint32 inc) external payable;

    function reverts() external;

    function reset() external;
}

contract TestCallable is ICallable {
    uint32 public fooCount = 0;
    address public lastCaller = address(bytes20(0));

    constructor() {}

    function reset() external override {
        fooCount = 0;
        lastCaller = address(bytes20(0));
    }

    function foo() external override {
        fooCount += 1;
        lastCaller = msg.sender;
    }

    function fooPayable() external payable override {
        fooCount += 1;
        lastCaller = msg.sender;
    }

    function fooWithArgs(uint32 inc) external override {
        fooCount += inc;
        lastCaller = msg.sender;
    }

    function fooPayableWithArgs(uint32 inc) external payable override {
        fooCount += inc;
        lastCaller = msg.sender;
    }

    function reverts() external pure override {
        revert("call should revert");
    }
}
