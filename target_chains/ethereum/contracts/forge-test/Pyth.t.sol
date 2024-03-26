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

contract PythTest is Test, WormholeTestUtils, PythTestUtils {
    IPyth public pyth;

    // -1 is equal to 0xffffff which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We will have less than 512 price for a foreseeable future.
    uint8 constant MERKLE_TREE_DEPTH = 9;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(NUM_GUARDIAN_SIGNERS)));
    }

    function generateRandomPriceAttestations(
        uint length
    )
        internal
        returns (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory attestations
        )
    {
        attestations = new PriceFeedMessage[](length);
        priceIds = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            attestations[i].priceId = bytes32(i + 1); // price ids should be non-zero and unique
            attestations[i].price = getRandInt64();
            attestations[i].conf = getRandUint64();
            attestations[i].expo = getRandInt32();
            attestations[i].emaPrice = getRandInt64();
            attestations[i].emaConf = getRandUint64();
            attestations[i].publishTime = getRandUint64();
            attestations[i].prevPublishTime = getRandUint64();

            priceIds[i] = attestations[i].priceId;
        }
    }

    // This method divides attestations into a couple of batches and creates
    // updateData for them. It returns the updateData and the updateFee
    function createBatchedUpdateDataFromAttestationsWithConfig(
        PriceFeedMessage[] memory attestations,
        MerkleUpdateConfig memory config
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        uint batchSize = 1 + (getRandUint() % attestations.length);
        uint numBatches = (attestations.length + batchSize - 1) / batchSize;

        updateData = new bytes[](numBatches);

        for (uint i = 0; i < attestations.length; i += batchSize) {
            uint len = batchSize;
            if (attestations.length - i < len) {
                len = attestations.length - i;
            }

            PriceFeedMessage[]
                memory batchAttestations = new PriceFeedMessage[](len);
            for (uint j = i; j < i + len; j++) {
                batchAttestations[j - i] = attestations[j];
            }

            updateData[i / batchSize] = generateWhMerkleUpdateWithSource(
                batchAttestations,
                config
            );
        }

        updateFee = pyth.getUpdateFee(updateData);
    }

    function createBatchedUpdateDataFromAttestations(
        PriceFeedMessage[] memory attestations
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        (
            updateData,
            updateFee
        ) = createBatchedUpdateDataFromAttestationsWithConfig(
            attestations,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
    }

    /// Testing parsePriceFeedUpdates method.
    function testParsePriceFeedUpdatesWorks(uint seed) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

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

    function testParsePriceFeedUpdatesWorksWithRandomDistinctUpdatesInput(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numAttestations = 1 + (getRandUint() % 30);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory attestations
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

        PriceFeedMessage[] memory selectedAttestations = new PriceFeedMessage[](
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

            assertEq(priceFeeds[i].price.price, selectedAttestations[i].price);
            assertEq(priceFeeds[i].price.conf, selectedAttestations[i].conf);
            assertEq(
                priceFeeds[i].price.publishTime,
                selectedAttestations[i].publishTime
            );
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                selectedAttestations[i].publishTime
            );
        }
    }

    function testParsePriceFeedUpdatesWorksWithOverlappingWithinTimeRangeUpdates()
        public
    {
        PriceFeedMessage[] memory attestations = new PriceFeedMessage[](2);

        attestations[0].priceId = bytes32(uint(1));
        attestations[0].price = 1000;
        attestations[0].publishTime = 10;

        attestations[1].priceId = bytes32(uint(1));
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
        PriceFeedMessage[] memory attestations = new PriceFeedMessage[](2);

        attestations[0].priceId = bytes32(uint(1));
        attestations[0].price = 1000;
        attestations[0].publishTime = 10;

        attestations[1].priceId = bytes32(uint(1));
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
            PriceFeedMessage[] memory attestations
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
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestationsWithConfig(
                attestations,
                MerkleUpdateConfig(
                    MERKLE_TREE_DEPTH,
                    NUM_GUARDIAN_SIGNERS,
                    SOURCE_EMITTER_CHAIN_ID,
                    SOURCE_EMITTER_ADDRESS,
                    true
                )
            );

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
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestationsWithConfig(
                attestations,
                MerkleUpdateConfig(
                    MERKLE_TREE_DEPTH,
                    NUM_GUARDIAN_SIGNERS,
                    SOURCE_EMITTER_CHAIN_ID + 1,
                    SOURCE_EMITTER_ADDRESS,
                    false
                )
            );

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
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        (bytes[] memory updateData, uint updateFee) = createBatchedUpdateDataFromAttestationsWithConfig(
            attestations,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                0x00000000000000000000000000000000000000000000000000000000000000aa, // Random wrong source address
                false
            )
        );

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfPriceIdNotIncluded() public {
        PriceFeedMessage[] memory attestations = new PriceFeedMessage[](1);

        attestations[0].priceId = bytes32(uint(1));
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
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        for (uint i = 0; i < numAttestations; i++) {
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

    function testParsePriceFeedUpdatesLatestPriceIfNecessary() public {
        uint numAttestations = 10;
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory attestations
        ) = generateRandomPriceAttestations(numAttestations);

        for (uint i = 0; i < numAttestations; i++) {
            attestations[i].publishTime = uint64((getRandUint() % 101)); // All between [0, 100]
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromAttestations(attestations);

        // Request for parse within the given time range should work and update the latest price
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            100
        );

        // Check if the latest price is updated
        for (uint i = 0; i < numAttestations; i++) {
            assertEq(
                pyth.getPriceUnsafe(priceIds[i]).publishTime,
                attestations[i].publishTime
            );
        }

        for (uint i = 0; i < numAttestations; i++) {
            attestations[i].publishTime = uint64(100 + (getRandUint() % 101)); // All between [100, 200]
        }

        (updateData, updateFee) = createBatchedUpdateDataFromAttestations(
            attestations
        );

        // Request for parse after the time range should revert.
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            300,
            400
        );

        // parse function reverted so publishTimes should remain less than or equal to 100
        for (uint i = 0; i < numAttestations; i++) {
            assertGe(100, pyth.getPriceUnsafe(priceIds[i]).publishTime);
        }

        // Time range is now fixed, so parse should work and update the latest price
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            100,
            200
        );

        // Check if the latest price is updated
        for (uint i = 0; i < numAttestations; i++) {
            assertEq(
                pyth.getPriceUnsafe(priceIds[i]).publishTime,
                attestations[i].publishTime
            );
        }
    }
}
