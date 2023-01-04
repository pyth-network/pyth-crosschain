// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../../contracts/pyth/PythUpgradable.sol";
import "../../contracts/pyth/PythInternalStructs.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/IPythEvents.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

import "forge-std/Test.sol";
import "./WormholeTestUtils.t.sol";

abstract contract PythTestUtils is Test, WormholeTestUtils {
    uint16 constant SOURCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant SOURCE_EMITTER_ADDRESS =
        0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b;

    uint16 constant GOVERNANCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant GOVERNANCE_EMITTER_ADDRESS =
        0x0000000000000000000000000000000000000000000000000000000000000011;

    function setUpPyth(address wormhole) public returns (address) {
        PythUpgradable implementation = new PythUpgradable();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            new bytes(0)
        );
        PythUpgradable pyth = PythUpgradable(address(proxy));

        uint16[] memory emitterChainIds = new uint16[](1);
        emitterChainIds[0] = SOURCE_EMITTER_CHAIN_ID;

        bytes32[] memory emitterAddresses = new bytes32[](1);
        emitterAddresses[0] = SOURCE_EMITTER_ADDRESS;

        pyth.initialize(
            wormhole,
            emitterChainIds,
            emitterAddresses,
            GOVERNANCE_EMITTER_CHAIN_ID,
            GOVERNANCE_EMITTER_ADDRESS,
            0, // Initial governance sequence
            60, // Valid time period in seconds
            1 // single update fee in wei
        );

        return address(pyth);
    }

    /// Utilities to help generating price attestations and VAAs for them

    enum PriceAttestationStatus {
        Unknown,
        Trading
    }

    struct PriceAttestation {
        bytes32 productId;
        bytes32 priceId;
        int64 price;
        uint64 conf;
        int32 expo;
        int64 emaPrice;
        uint64 emaConf;
        PriceAttestationStatus status;
        uint32 numPublishers;
        uint32 maxNumPublishers;
        uint64 attestationTime;
        uint64 publishTime;
        uint64 prevPublishTime;
        int64 prevPrice;
        uint64 prevConf;
    }

    // Generates byte-encoded payload for the given price attestations. You can use this to mock wormhole
    // call using `vm.mockCall` and return a VM struct with this payload.
    // You can use generatePriceFeedUpdateVAA to generate a VAA for a price update.
    function generatePriceFeedUpdatePayload(
        PriceAttestation[] memory attestations
    ) public pure returns (bytes memory payload) {
        bytes memory encodedAttestations = new bytes(0);

        for (uint i = 0; i < attestations.length; ++i) {
            // encodePacked uses padding for arrays and we don't want it, so we manually concat them.
            encodedAttestations = abi.encodePacked(
                encodedAttestations,
                attestations[i].productId,
                attestations[i].priceId,
                attestations[i].price,
                attestations[i].conf,
                attestations[i].expo,
                attestations[i].emaPrice,
                attestations[i].emaConf
            );

            // Breaking this in two encodePackes because of the limited EVM stack.
            encodedAttestations = abi.encodePacked(
                encodedAttestations,
                uint8(attestations[i].status),
                attestations[i].numPublishers,
                attestations[i].maxNumPublishers,
                attestations[i].attestationTime,
                attestations[i].publishTime,
                attestations[i].prevPublishTime,
                attestations[i].prevPrice,
                attestations[i].prevConf
            );
        }

        payload = abi.encodePacked(
            uint32(0x50325748), // Magic
            uint16(3), // Major version
            uint16(0), // Minor version
            uint16(1), // Header size of 1 byte as it only contains payloadId
            uint8(2), // Payload ID 2 means it's a batch price attestation
            uint16(attestations.length), // Number of attestations
            uint16(encodedAttestations.length / attestations.length), // Size of a single price attestation.
            encodedAttestations
        );
    }

    // Generates a VAA for the given attestations.
    // This method calls generatePriceFeedUpdatePayload and then creates a VAA with it.
    // The VAAs generated from this method use block timestamp as their timestamp.
    function generatePriceFeedUpdateVAA(
        PriceAttestation[] memory attestations,
        uint64 sequence,
        uint8 numSigners
    ) public returns (bytes memory vaa) {
        bytes memory payload = generatePriceFeedUpdatePayload(attestations);

        vaa = generateVaa(
            uint32(block.timestamp),
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            sequence,
            payload,
            numSigners
        );
    }

    function pricesToPriceAttestations(
        bytes32[] memory priceIds,
        PythStructs.Price[] memory prices
    ) public returns (PriceAttestation[] memory attestations) {
        assertEq(priceIds.length, prices.length);
        attestations = new PriceAttestation[](prices.length);

        for (uint i = 0; i < prices.length; ++i) {
            // Product ID, we use the same price Id. This field is not used.
            attestations[i].productId = priceIds[i];
            attestations[i].priceId = priceIds[i];
            attestations[i].price = prices[i].price;
            attestations[i].conf = prices[i].conf;
            attestations[i].expo = prices[i].expo;
            // Same price and conf is used for emaPrice and emaConf
            attestations[i].emaPrice = prices[i].price;
            attestations[i].emaConf = prices[i].conf;
            attestations[i].status = PriceAttestationStatus.Trading;
            attestations[i].numPublishers = 5; // This field is not used
            attestations[i].maxNumPublishers = 10; // This field is not used
            attestations[i].attestationTime = uint64(prices[i].publishTime); // This field is not used
            attestations[i].publishTime = uint64(prices[i].publishTime);
            // Fields below are not used when status is Trading. just setting them to
            // the same value as the prices.
            attestations[i].prevPublishTime = uint64(prices[i].publishTime);
            attestations[i].prevPrice = prices[i].price;
            attestations[i].prevConf = prices[i].conf;
        }
    }
}

contract PythTestUtilsTest is
    Test,
    WormholeTestUtils,
    PythTestUtils,
    IPythEvents
{
    function testGeneratePriceFeedUpdateVAAWorks() public {
        IPyth pyth = IPyth(
            setUpPyth(
                setUpWormhole(
                    1 // Number of guardians
                )
            )
        );

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[
            0
        ] = 0x0000000000000000000000000000000000000000000000000000000000000222;

        PythStructs.Price[] memory prices = new PythStructs.Price[](1);
        prices[0] = PythStructs.Price(
            100, // Price
            10, // Confidence
            -5, // Exponent
            1 // Publish time
        );

        bytes memory vaa = generatePriceFeedUpdateVAA(
            pricesToPriceAttestations(priceIds, prices),
            1, // Sequence
            1 // No. Signers
        );

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = vaa;

        uint updateFee = pyth.getUpdateFee(updateData);

        vm.expectEmit(true, true, false, true);
        emit PriceFeedUpdate(priceIds[0], 1, 100, 10);

        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }
}
