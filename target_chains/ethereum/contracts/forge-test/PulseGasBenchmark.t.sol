// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";
import "../contracts/pulse/PulseEvents.sol";
import "../contracts/pulse/PulseErrors.sol";
import "./utils/PulseTestUtils.t.sol";
import "./Pulse.t.sol";

contract PulseGasBenchmark is Test, PulseTestUtils {
    ERC1967Proxy public proxy;
    PulseUpgradeable public pulse;
    IPulseConsumer public consumer;

    address public owner;
    address public admin;
    address public pyth;
    address public defaultProvider;

    uint96 constant PYTH_FEE = 1 wei;
    uint96 constant DEFAULT_PROVIDER_FEE_PER_GAS = 1 wei;
    uint96 constant DEFAULT_PROVIDER_BASE_FEE = 1 wei;
    uint96 constant DEFAULT_PROVIDER_FEE_PER_FEED = 10 wei;

    function setUp() public {
        owner = address(1);
        admin = address(2);
        pyth = address(3);
        defaultProvider = address(4);
        PulseUpgradeable _pulse = new ConcretePulseUpgradeable();
        proxy = new ERC1967Proxy(address(_pulse), "");
        pulse = PulseUpgradeable(address(proxy));

        pulse.initialize(
            owner,
            admin,
            PYTH_FEE,
            pyth,
            defaultProvider,
            false,
            15
        );
        vm.prank(defaultProvider);
        pulse.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );
        consumer = new VoidPulseConsumer(address(proxy));
    }

    // Estimate how much gas is used by all of the data mocking functionality in the other gas benchmarks.
    // Subtract this amount from the gas benchmarks to estimate the true usage of the pulse flow.
    function testDataMocking() public {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        createPriceIds();

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        createMockUpdateData(priceFeeds);
    }

    function testBasicFlow() public {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        bytes32[] memory priceIds = createPriceIds();

        uint32 callbackGasLimit = 100000;
        uint96 totalFee = pulse.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );
        vm.deal(address(consumer), 1 ether);
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(defaultProvider, timestamp, priceIds, callbackGasLimit);

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        pulse.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }
}

// A simple consumer that does nothing with the price updates.
// Used to estimate the gas usage of the pulse flow.
contract VoidPulseConsumer is IPulseConsumer {
    address private _pulse;

    constructor(address pulse) {
        _pulse = pulse;
    }

    function getPulse() internal view override returns (address) {
        return _pulse;
    }

    function pulseCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal override {}
}
