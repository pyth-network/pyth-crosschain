// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "../contracts/executor/Executor.sol";
import "./utils/WormholeTestUtils.t.sol";

contract ExecutorTest is Test, WormholeTestUtils {
    Wormhole public wormhole;
    Executor public executor;
    TestCallable public callable;

    uint16 OWNER_CHAIN_ID = 7;
    bytes32 OWNER_EMITTER = bytes32(uint256(1));

    uint8 NUM_SIGNERS = 1;

    function setUp() public {
        address _wormhole = setUpWormholeReceiver(NUM_SIGNERS);
        executor = new Executor(
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
        uint64 sequence
    ) internal returns (bytes memory vaa) {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            callAddress,
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

    function testCallSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            1
        );
        assertEq(callable.fooCount(), c + 1);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallWithArgsSucceeds() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.fooWithArgs.selector, 17),
            1
        );
        assertEq(callable.fooCount(), c + 17);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallerAddress() public {
        uint32 c = callable.fooCount();
        testExecute(
            address(callable),
            abi.encodeWithSelector(ICallable.foo.selector),
            1
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
            3
        );

        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.Execute,
            CHAIN_ID,
            address(executor),
            address(callable),
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
            4
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
}

interface ICallable {
    function foo() external;

    function fooWithArgs(uint32 inc) external;

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

    function fooWithArgs(uint32 inc) external override {
        fooCount += inc;
        lastCaller = msg.sender;
    }

    function reverts() external override {
        revert("call should revert");
    }
}
