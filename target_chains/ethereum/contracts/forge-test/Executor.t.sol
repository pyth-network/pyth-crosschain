// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.12;

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
            // TODO: make these arguments so we can do adversarial tests
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            sequence,
            payload,
            NUM_SIGNERS
        );

        executor.execute(vaa);
    }

    function testBasic() public {
        callable.reset();

        uint32 c = callable.fooCount();
        assertEq(callable.lastCaller(), address(bytes20(0)));
        testExecute(address(callable), abi.encodeCall(ICallable.foo, ()), 1);
        assertEq(callable.fooCount(), c + 1);
        assertEq(callable.lastCaller(), address(executor));
        // Sanity check to make sure the check above is meaningful.
        assert(address(executor) != address(this));
    }

    function testCallerAddress() public {
        uint32 c = callable.fooCount();
        testExecute(address(callable), abi.encodeCall(ICallable.foo, ()), 1);
        assertEq(callable.fooCount(), c + 1);
    }
}

interface ICallable {
    function foo() external;

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
}
