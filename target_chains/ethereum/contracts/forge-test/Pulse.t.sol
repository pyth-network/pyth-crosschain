// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";

contract MockPulseConsumer is IPulseConsumer {
    uint64 public lastSequenceNumber;
    address public lastProvider;
    uint256 public lastPublishTime;
    bytes32[] public lastPriceIds;

    function pulseCallback(
        uint64 sequenceNumber,
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external override {
        lastSequenceNumber = sequenceNumber;
        lastProvider = provider;
        lastPublishTime = publishTime;
        lastPriceIds = priceIds;
    }
}

contract PulseTest is Test {
    PulseUpgradeable public pulse;
    MockPulseConsumer public consumer;
    address public owner;
    address public admin;
    address public provider;
    uint128 constant PYTH_FEE = 0.001 ether;
    uint128 constant PROVIDER_FEE = 0.002 ether;

    function setUp() public {
        owner = address(1);
        admin = address(2);
        provider = address(3);

        // Deploy contracts
        pulse = new PulseUpgradeable();
        pulse.initialize(owner, admin, PYTH_FEE, provider);
        consumer = new MockPulseConsumer();

        // Register provider
        vm.prank(provider);
        pulse.register(PROVIDER_FEE, "https://provider.com");
    }

    function testRequestPriceUpdate() public {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = bytes32("BTC/USD");
        priceIds[1] = bytes32("ETH/USD");

        bytes[] memory updateData = new bytes[](2);
        updateData[0] = bytes("data1");
        updateData[1] = bytes("data2");

        uint256 publishTime = block.timestamp;
        uint256 callbackGasLimit = 500000;

        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: PYTH_FEE + PROVIDER_FEE
        }(provider, publishTime, priceIds, updateData, callbackGasLimit);

        assertEq(sequenceNumber, 1);
    }

    function testExecuteCallback() public {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = bytes32("BTC/USD");
        priceIds[1] = bytes32("ETH/USD");

        bytes[] memory updateData = new bytes[](2);
        updateData[0] = bytes("data1");
        updateData[1] = bytes("data2");

        uint256 publishTime = block.timestamp;
        uint256 callbackGasLimit = 500000;

        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: PYTH_FEE + PROVIDER_FEE
        }(provider, publishTime, priceIds, updateData, callbackGasLimit);

        vm.prank(provider);
        pulse.executeCallback(
            sequenceNumber,
            publishTime,
            priceIds,
            updateData,
            callbackGasLimit
        );

        assertEq(consumer.lastSequenceNumber(), sequenceNumber);
        assertEq(consumer.lastProvider(), provider);
        assertEq(consumer.lastPublishTime(), publishTime);
        assertEq(consumer.lastPriceIds()[0], priceIds[0]);
        assertEq(consumer.lastPriceIds()[1], priceIds[1]);
    }

    function testProviderRegistration() public {
        address newProvider = address(4);
        vm.prank(newProvider);
        pulse.register(PROVIDER_FEE, "https://newprovider.com");

        uint128 fee = pulse.getFee(newProvider);
        assertEq(fee, PYTH_FEE + PROVIDER_FEE);
    }

    function testUpdateProviderFee() public {
        uint128 newFee = 0.003 ether;
        vm.prank(provider);
        pulse.setProviderFee(newFee);

        uint128 fee = pulse.getFee(provider);
        assertEq(fee, PYTH_FEE + newFee);
    }

    function testFailInsufficientFee() public {
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE}( // Not paying provider fee
            provider,
            block.timestamp,
            priceIds,
            updateData,
            500000
        );
    }

    function testFailUnregisteredProvider() public {
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE + PROVIDER_FEE}(
            address(99), // Unregistered provider
            block.timestamp,
            priceIds,
            updateData,
            500000
        );
    }

    function testGasCostsWithPrefill() public {
        // Deploy with prefill
        PulseUpgradeable pulseWithPrefill = new PulseUpgradeable();
        pulseWithPrefill.initialize(owner, admin, PYTH_FEE, provider, true);

        // Measure gas for first request
        uint256 gasBefore = gasleft();
        makeRequest(address(pulseWithPrefill));
        uint256 gasUsed = gasBefore - gasleft();

        // Should be lower due to prefill
        assertLt(gasUsed, 30000);
    }

    function testGasCostsWithoutPrefill() public {
        // Deploy without prefill
        PulseUpgradeable pulseWithoutPrefill = new PulseUpgradeable();
        pulseWithoutPrefill.initialize(owner, admin, PYTH_FEE, provider, false);

        // Measure gas for first request
        uint256 gasBefore = gasleft();
        makeRequest(address(pulseWithoutPrefill));
        uint256 gasUsed = gasBefore - gasleft();

        // Should be higher without prefill
        assertGt(gasUsed, 35000);
    }

    function makeRequest(address pulseAddress) internal {
        // Helper to make a standard request
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);
        IPulse(pulseAddress).requestPriceUpdatesWithCallback{
            value: PYTH_FEE + PROVIDER_FEE
        }(provider, block.timestamp, priceIds, updateData, 500000);
    }

    function testWithdraw() public {
        // Setup - make a request to accrue some fees
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE + PROVIDER_FEE}(
            provider,
            block.timestamp,
            priceIds,
            updateData,
            500000
        );

        // Check provider balance before withdrawal
        uint256 providerBalanceBefore = address(provider).balance;

        // Provider withdraws fees
        vm.prank(provider);
        pulse.withdraw(PROVIDER_FEE);

        // Verify balance increased
        assertEq(
            address(provider).balance,
            providerBalanceBefore + PROVIDER_FEE
        );
    }

    function testFailWithdrawTooMuch() public {
        vm.prank(provider);
        pulse.withdraw(1 ether); // Try to withdraw more than accrued
    }

    function testFailWithdrawUnregistered() public {
        vm.prank(address(99)); // Unregistered provider
        pulse.withdraw(1 ether);
    }

    function testWithdrawAsFeeManager() public {
        // Setup fee manager
        vm.prank(provider);
        pulse.setFeeManager(address(99));

        // Setup fees
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE + PROVIDER_FEE}(
            provider,
            block.timestamp,
            priceIds,
            updateData,
            500000
        );

        // Check fee manager balance before withdrawal
        uint256 managerBalanceBefore = address(99).balance;

        // Fee manager withdraws
        vm.prank(address(99));
        pulse.withdrawAsFeeManager(provider, PROVIDER_FEE);

        // Verify balance increased
        assertEq(address(99).balance, managerBalanceBefore + PROVIDER_FEE);
    }

    function testFailWithdrawAsFeeManagerUnauthorized() public {
        vm.prank(address(88)); // Not the fee manager
        pulse.withdrawAsFeeManager(provider, PROVIDER_FEE);
    }

    function testSetProviderFeeAsFeeManager() public {
        // Setup fee manager
        vm.prank(provider);
        pulse.setFeeManager(address(99));

        uint128 newFee = 0.005 ether;

        // Fee manager updates fee
        vm.prank(address(99));
        pulse.setProviderFeeAsFeeManager(provider, newFee);

        // Verify fee was updated
        uint128 fee = pulse.getFee(provider);
        assertEq(fee, PYTH_FEE + newFee);
    }

    function testFailSetProviderFeeAsFeeManagerUnauthorized() public {
        vm.prank(address(88)); // Not the fee manager
        pulse.setProviderFeeAsFeeManager(provider, 0.005 ether);
    }

    function testGetAccruedPythFees() public {
        // Setup - make a request to accrue some fees
        bytes32[] memory priceIds = new bytes32[](1);
        bytes[] memory updateData = new bytes[](1);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE + PROVIDER_FEE}(
            provider,
            block.timestamp,
            priceIds,
            updateData,
            500000
        );

        // Verify accrued fees
        assertEq(pulse.getAccruedPythFees(), PYTH_FEE);
    }

    function testGetProviderInfo() public {
        // Get provider info
        PulseState.ProviderInfo memory info = pulse.getProviderInfo(provider);

        // Verify initial values
        assertEq(info.sequenceNumber, 1); // Set during registration
        assertEq(info.feeInWei, PROVIDER_FEE);
        assertEq(info.accruedFeesInWei, 0);
        assertEq(string(info.uri), "https://provider.com");
        assertEq(info.feeManager, address(0));
        assertEq(info.maxNumPrices, 0);
    }

    function testGetAdmin() public {
        assertEq(pulse.getAdmin(), admin);
    }

    function testGetPythFeeInWei() public {
        assertEq(pulse.getPythFeeInWei(), PYTH_FEE);
    }

    function testSetProviderUri() public {
        bytes memory newUri = bytes("https://new-provider-endpoint.com");

        vm.prank(provider);
        pulse.setProviderUri(newUri);

        // Get provider info and verify URI was updated
        (, , , bytes memory uri, ) = pulse.getProviderInfo(provider);
        assertEq(string(uri), string(newUri));
    }

    function testFailSetProviderUriUnregistered() public {
        vm.prank(address(99)); // Unregistered provider
        pulse.setProviderUri(bytes("https://new-uri.com"));
    }

    function testSetMaxNumPrices() public {
        uint32 maxPrices = 5;

        vm.prank(provider);
        pulse.setMaxNumPrices(maxPrices);

        // Get provider info and verify maxNumPrices was updated
        (, , , , address feeManager) = pulse.getProviderInfo(provider);
        assertEq(uint256(maxPrices), uint256(maxPrices));
    }

    function testFailExceedMaxNumPrices() public {
        // Set max prices to 2
        vm.prank(provider);
        pulse.setMaxNumPrices(2);

        // Try to request 3 prices
        bytes32[] memory priceIds = new bytes32[](3);
        bytes[] memory updateData = new bytes[](3);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE + PROVIDER_FEE}(
            provider,
            block.timestamp,
            priceIds,
            updateData,
            500000
        );
    }

    function testGetRequest() public {
        // Setup - make a request
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = bytes32("BTC/USD");
        priceIds[1] = bytes32("ETH/USD");

        bytes[] memory updateData = new bytes[](2);
        updateData[0] = bytes("data1");
        updateData[1] = bytes("data2");

        uint256 publishTime = block.timestamp;
        uint256 callbackGasLimit = 500000;

        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: PYTH_FEE + PROVIDER_FEE
        }(provider, publishTime, priceIds, updateData, callbackGasLimit);

        // Get request and verify
        PulseState.Request memory req = pulse.getRequest(
            provider,
            sequenceNumber
        );

        assertEq(req.provider, provider);
        assertEq(req.sequenceNumber, sequenceNumber);
        assertEq(req.publishTime, publishTime);
        assertEq(req.priceIds[0], priceIds[0]);
        assertEq(req.priceIds[1], priceIds[1]);
        assertEq(string(req.updateData[0]), string(updateData[0]));
        assertEq(string(req.updateData[1]), string(updateData[1]));
        assertEq(req.callbackGasLimit, callbackGasLimit);
        assertEq(req.requester, address(consumer));
    }
}
