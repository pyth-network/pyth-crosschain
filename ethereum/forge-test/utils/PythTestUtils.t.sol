// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../../contracts/pyth/PythUpgradable.sol";
import "../../contracts/pyth/PythInternalStructs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";


import "forge-std/Test.sol";
import "./WormholeTestUtils.t.sol";

abstract contract PythTestUtils is Test, WormholeTestUtils {
    uint16 constant SOURCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant SOURCE_EMITTER_ADDRESS = 0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b;

    uint16 constant GOVERNANCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant GOVERNANCE_EMITTER_ADDRESS = 0x0000000000000000000000000000000000000000000000000000000000000011;

    function setUpPyth(address wormhole) public returns (address) {
        PythUpgradable implementation = new PythUpgradable();
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), new bytes(0));
        PythUpgradable pyth = PythUpgradable(address(proxy));
        pyth.initialize(
            wormhole,
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS
        );

        // TODO: All the logic below should be moved to the initializer
        pyth.addDataSource(
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS
        );

        pyth.updateSingleUpdateFeeInWei(
            1
        );

        pyth.updateValidTimePeriodSeconds(
            60
        );

        pyth.updateGovernanceDataSource(
            GOVERNANCE_EMITTER_CHAIN_ID,
            GOVERNANCE_EMITTER_ADDRESS,
            0
        );

        return address(pyth);
    }

    // Generates byte-encoded payload for the given prices. It sets the emaPrice the same
    // as the given price. You can use this to mock wormhole call using `vm.mockCall` and
    // return a VM struct with this payload.
    // You can use generatePriceFeedUpdateVAA to generate a VAA for a price update.
    function generatePriceFeedUpdatePayload(
        bytes32[] memory priceIds,
        PythStructs.Price[] memory prices
    ) public returns (bytes memory payload) {
        assertEq(priceIds.length, prices.length);

        bytes memory attestations = new bytes(0);

        for (uint i = 0; i < prices.length; ++i) {
            // encodePacked uses padding for arrays and we don't want it, so we manually concat them.
            attestations = abi.encodePacked(
                attestations,
                priceIds[i], // Product ID, we use the same price Id. This field is not used.
                priceIds[i], // Price ID,
                prices[i].price, // Price
                prices[i].conf, // Confidence
                prices[i].expo, // Exponent
                prices[i].price, // EMA price
                prices[i].conf // EMA confidence
            );

            // Breaking this in two encodePackes because of the limited EVM stack.
            attestations = abi.encodePacked(
                attestations,
                uint8(PythInternalStructs.PriceAttestationStatus.TRADING),
                uint32(5), // Number of publishers. This field is not used.
                uint32(10), // Maximum number of publishers. This field is not used.
                uint64(prices[i].publishTime), // Attestation time. This field is not used.
                uint64(prices[i].publishTime), // Publish time.
                // Previous values are unused as status is trading. We use the same value
                // to make sure the test is irrelevant of the logic of which price is chosen.
                uint64(prices[i].publishTime), // Previous publish time.
                prices[i].price, // Previous price
                prices[i].conf // Previous confidence
            );
        }

        payload = abi.encodePacked(
            uint32(0x50325748), // Magic
            uint16(3), // Major version
            uint16(0), // Minor version
            uint16(1), // Header size of 1 byte as it only contains payloadId
            uint8(2), // Payload ID 2 means it's a batch price attestation
            uint16(prices.length), // Number of attestations
            uint16(attestations.length / prices.length), // Size of a single price attestation.
            attestations
        );
    }

    // Generates a VAA for the given prices.
    // This method calls generatePriceFeedUpdatePayload and then creates a VAA with it.
    // The VAAs generated from this method use block timestamp as their timestamp.
    function generatePriceFeedUpdateVAA(
        bytes32[] memory priceIds,
        PythStructs.Price[] memory prices,
        uint64 sequence,
        uint8 noSigners
    ) public returns (bytes memory vaa) {
        bytes memory payload = generatePriceFeedUpdatePayload(
            priceIds,
            prices
        );
        
        vaa = generateVaa(
            uint32(block.timestamp),
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            sequence,
            payload,
            noSigners
        );
    }
}

contract PythTestUtilsTest is Test, WormholeTestUtils, PythTestUtils {
    // TODO: It is better to have a PythEvents contract that be extendable. 
    event PriceFeedUpdate(bytes32 indexed id, bool indexed fresh, uint16 chainId, uint64 sequenceNumber, uint lastPublishTime, uint publishTime, int64 price, uint64 conf);

    function testGeneratePriceFeedUpdateVAAWorks() public {
        IPyth pyth = IPyth(setUpPyth(setUpWormhole(
            1 // Number of guardians
        )));

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = 0x0000000000000000000000000000000000000000000000000000000000000222;

        PythStructs.Price[] memory prices = new PythStructs.Price[](1);
        prices[0] = PythStructs.Price(
            100, // Price
            10, // Confidence
            -5, // Exponent
            1 // Publish time
        );

        bytes memory vaa = generatePriceFeedUpdateVAA(
            priceIds,
            prices,
            1, // Sequence
            1 // No. Signers
        );

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = vaa;

        uint updateFee = pyth.getUpdateFee(updateData);

        vm.expectEmit(true, true, false, true);
        emit PriceFeedUpdate(priceIds[0], true, SOURCE_EMITTER_CHAIN_ID, 1, 0, 1, 100, 10);

        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }
}
