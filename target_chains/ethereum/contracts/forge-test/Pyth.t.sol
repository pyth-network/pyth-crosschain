// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";

contract PythTest is Test, WormholeTestUtils, PythTestUtils, RandTestUtils {
    IPyth public pyth;

    // -1 is equal to 0x111111 which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormhole(1)));
    }

    function generateRandomPriceAttestations(
        uint length
    )
        internal
        returns (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        )
    {
        attestations = new PriceAttestation[](length);
        priceIds = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            attestations[i].productId = getRandBytes32();
            attestations[i].priceId = bytes32(i + 1); // price ids should be non-zero and unique
            attestations[i].price = getRandInt64();
            attestations[i].conf = getRandUint64();
            attestations[i].expo = getRandInt32();
            attestations[i].emaPrice = getRandInt64();
            attestations[i].emaConf = getRandUint64();
            attestations[i].status = PriceAttestationStatus(getRandUint() % 2);
            attestations[i].numPublishers = getRandUint32();
            attestations[i].maxNumPublishers = getRandUint32();
            attestations[i].attestationTime = getRandUint64();
            attestations[i].publishTime = getRandUint64();
            attestations[i].prevPublishTime = getRandUint64();
            attestations[i].price = getRandInt64();
            attestations[i].conf = getRandUint64();

            priceIds[i] = attestations[i].priceId;
        }
    }

    // This method divides attestations into a couple of batches and creates
    // updateData for them. It returns the updateData and the updateFee
    function createBatchedUpdateDataFromAttestations(
        PriceAttestation[] memory attestations
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        uint batchSize = 1 + (getRandUint() % attestations.length);
        uint numBatches = (attestations.length + batchSize - 1) / batchSize;

        updateData = new bytes[](numBatches);

        for (uint i = 0; i < attestations.length; i += batchSize) {
            uint len = batchSize;
            if (attestations.length - i < len) {
                len = attestations.length - i;
            }

            PriceAttestation[]
                memory batchAttestations = new PriceAttestation[](len);
            for (uint j = i; j < i + len; j++) {
                batchAttestations[j - i] = attestations[j];
            }

            updateData[i / batchSize] = generatePriceFeedUpdateVAA(
                batchAttestations,
                0,
                1
            );
        }

        updateFee = pyth.getUpdateFee(updateData);
    }

    /// Testing parsePriceFeedUpdates method.
    function testParsePriceFeedUpdatesWorksWithTradingStatus(uint seed) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        for (uint i = 0; i < numAttestations; i++) {
            attestations[i].status = PriceAttestationStatus.Trading;
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        for (uint i = 0; i < numAttestations; i++) {
            assertEq(priceFeeds[i].id, priceIds[i]);
            assertEq(priceFeeds[i].price.price, attestations[i].price);
            assertEq(priceFeeds[i].price.conf, attestations[i].conf);
            assertEq(priceFeeds[i].price.expo, attestations[i].expo);
            assertEq(
                priceFeeds[i].price.publishTime,
                attestations[i].publishTime
            );
            assertEq(priceFeeds[i].emaPrice.price, attestations[i].emaPrice);
            assertEq(priceFeeds[i].emaPrice.conf, attestations[i].emaConf);
            assertEq(priceFeeds[i].emaPrice.expo, attestations[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                attestations[i].publishTime
            );
        }
    }

    function testParsePriceFeedUpdatesWorksWithUnknownStatus(uint seed) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        for (uint i = 0; i < numAttestations; i++) {
            attestations[i].status = PriceAttestationStatus.Unknown;
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        for (uint i = 0; i < numAttestations; i++) {
            assertEq(priceFeeds[i].id, priceIds[i]);
            assertEq(priceFeeds[i].price.price, attestations[i].prevPrice);
            assertEq(priceFeeds[i].price.conf, attestations[i].prevConf);
            assertEq(priceFeeds[i].price.expo, attestations[i].expo);
            assertEq(
                priceFeeds[i].price.publishTime,
                attestations[i].prevPublishTime
            );
            assertEq(priceFeeds[i].emaPrice.price, attestations[i].emaPrice);
            assertEq(priceFeeds[i].emaPrice.conf, attestations[i].emaConf);
            assertEq(priceFeeds[i].emaPrice.expo, attestations[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                attestations[i].prevPublishTime
            );
        }
    }

    function testParsePriceFeedUpdatesWorksWithRandomDistinctUpdatesInput(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 30);
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        // Shuffle the attestations
        for (uint i = 1; i < numAttestations; i++) {
            uint swapWith = getRandUint() % (i + 1);
            (attestations[i], attestations[swapWith]) = (
                attestations[swapWith],
                attestations[i]
            );
            (priceIds[i], priceIds[swapWith]) = (
                priceIds[swapWith],
                priceIds[i]
            );
        }

        // Select only first numSelectedAttestations. numSelectedAttestations will be in [0, numAttestations]
        uint numSelectedAttestations = getRandUint() % (numAttestations + 1);

        PriceAttestation[] memory selectedAttestations = new PriceAttestation[](
            numSelectedAttestations
        );
        bytes32[] memory selectedPriceIds = new bytes32[](
            numSelectedAttestations
        );

        for (uint i = 0; i < numSelectedAttestations; i++) {
            selectedAttestations[i] = attestations[i];
            selectedPriceIds[i] = priceIds[i];
        }

        // Only parse selected attestations
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, selectedPriceIds, 0, MAX_UINT64);

        for (uint i = 0; i < numSelectedAttestations; i++) {
            assertEq(priceFeeds[i].id, selectedPriceIds[i]);
            assertEq(priceFeeds[i].price.expo, selectedAttestations[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.price,
                selectedAttestations[i].emaPrice
            );
            assertEq(
                priceFeeds[i].emaPrice.conf,
                selectedAttestations[i].emaConf
            );
            assertEq(priceFeeds[i].emaPrice.expo, selectedAttestations[i].expo);

            if (
                selectedAttestations[i].status == PriceAttestationStatus.Trading
            ) {
                assertEq(
                    priceFeeds[i].price.price,
                    selectedAttestations[i].price
                );
                assertEq(
                    priceFeeds[i].price.conf,
                    selectedAttestations[i].conf
                );
                assertEq(
                    priceFeeds[i].price.publishTime,
                    selectedAttestations[i].publishTime
                );
                assertEq(
                    priceFeeds[i].emaPrice.publishTime,
                    selectedAttestations[i].publishTime
                );
            } else {
                assertEq(
                    priceFeeds[i].price.price,
                    selectedAttestations[i].prevPrice
                );
                assertEq(
                    priceFeeds[i].price.conf,
                    selectedAttestations[i].prevConf
                );
                assertEq(
                    priceFeeds[i].price.publishTime,
                    selectedAttestations[i].prevPublishTime
                );
                assertEq(
                    priceFeeds[i].emaPrice.publishTime,
                    selectedAttestations[i].prevPublishTime
                );
            }
        }
    }

    function testParsePriceFeedUpdatesWorksWithOverlappingWithinTimeRangeUpdates()
        public
    {
        PriceAttestation[] memory attestations = new PriceAttestation[](2);

        attestations[0].priceId = bytes32(uint(1));
        attestations[0].status = PriceAttestationStatus.Trading;
        attestations[0].price = 1000;
        attestations[0].publishTime = 10;

        attestations[1].priceId = bytes32(uint(1));
        attestations[1].status = PriceAttestationStatus.Trading;
        attestations[1].price = 2000;
        attestations[1].publishTime = 20;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(1));

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, 20);

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));

        assertTrue(
            (priceFeeds[0].price.price == 1000 &&
                priceFeeds[0].price.publishTime == 10) ||
                (priceFeeds[0].price.price == 2000 &&
                    priceFeeds[0].price.publishTime == 20)
        );
    }

    function testParsePriceFeedUpdatesWorksWithOverlappingMixedTimeRangeUpdates()
        public
    {
        PriceAttestation[] memory attestations = new PriceAttestation[](2);

        attestations[0].priceId = bytes32(uint(1));
        attestations[0].status = PriceAttestationStatus.Trading;
        attestations[0].price = 1000;
        attestations[0].publishTime = 10;

        attestations[1].priceId = bytes32(uint(1));
        attestations[1].status = PriceAttestationStatus.Trading;
        attestations[1].price = 2000;
        attestations[1].publishTime = 20;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(1));

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 5, 15);

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));
        assertEq(priceFeeds[0].price.price, 1000);
        assertEq(priceFeeds[0].price.publishTime, 10);

        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            15,
            25
        );

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));
        assertEq(priceFeeds[0].price.price, 2000);
        assertEq(priceFeeds[0].price.publishTime, 20);
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateFeeIsNotPaid() public {
        uint numAttestations = 10;
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        // Since attestations are not empty the fee should be at least 1
        assertGe(updateFee, 1);

        vm.expectRevert(PythErrors.InsufficientFee.selector);

        pyth.parsePriceFeedUpdates{value: updateFee - 1}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateVAAIsInvalid(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        uint mutPos = getRandUint() % updateData[0].length;

        // mutate the random position by 1 bit
        updateData[0][mutPos] = bytes1(uint8(updateData[0][mutPos]) ^ 1);

        // It might revert due to different wormhole errors
        vm.expectRevert();
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateSourceChainIsInvalid()
        public
    {
        uint numAttestations = 10;
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = generateVaa(
            uint32(block.timestamp),
            SOURCE_EMITTER_CHAIN_ID + 1,
            SOURCE_EMITTER_ADDRESS,
            1, // Sequence
            generatePriceFeedUpdatePayload(attestations),
            1 // Num signers
        );

        uint updateFee = pyth.getUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateSourceAddressIsInvalid()
        public
    {
        uint numAttestations = 10;
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = generateVaa(
            uint32(block.timestamp),
            SOURCE_EMITTER_CHAIN_ID,
            0x00000000000000000000000000000000000000000000000000000000000000aa, // Random wrong source address
            1, // Sequence
            generatePriceFeedUpdatePayload(attestations),
            1 // Num signers
        );

        uint updateFee = pyth.getUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfPriceIdNotIncluded() public {
        PriceAttestation[] memory attestations = new PriceAttestation[](1);

        attestations[0].priceId = bytes32(uint(1));
        attestations[0].status = PriceAttestationStatus.Trading;
        attestations[0].price = 1000;
        attestations[0].publishTime = 10;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(2));

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdateRevertsIfPricesOutOfTimeRange() public {
        uint numAttestations = 10;
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        for (uint i = 0; i < numAttestations; i++) {
            // Set status to Trading so publishTime is used
            attestations[i].status = PriceAttestationStatus.Trading;
            attestations[i].publishTime = uint64(100 + (getRandUint() % 101)); // All between [100, 200]
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        // Request for parse within the given time range should work
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            100,
            200
        );

        // Request for parse after the time range should revert.
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            300,
            MAX_UINT64
        );
    }

    function testRequirePriceFeeds() public {
        uint numAttestations = 1;
        (
            bytes32[] memory priceIds,
            PriceAttestation[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        vm.expectRevert(
            abi.encodeWithSelector(
                PythErrors.RequirePriceFeeds.selector,
                priceIds
            )
        );
        pyth.requirePriceFeeds(priceIds);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        // console.log(address(this));
        // console.log(address(this).balance);
        // console.log(address(pyth).balance);
        // payable(address(this)).transfer(100);

        bytes32 requestId1 = pyth.updatePriceFeedsOnBehalfOf{value: updateFee}(
            tx.origin,
            priceIds,
            updateData
        );
        console.logBytes32(requestId1);
        console.log(address(this).balance);
        bytes32 requestId2 = pyth.requirePriceFeeds{value: 7}(priceIds);
        console.logBytes32(requestId2);
        console.log(address(this).balance);
    }

    fallback() external payable {}
}
