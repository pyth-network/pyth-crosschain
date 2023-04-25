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

contract PythWormholeMerkleAccumulatorTest is
    Test,
    WormholeTestUtils,
    PythTestUtils,
    RandTestUtils
{
    IPyth public pyth;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormhole(1)));
    }

    function generateRandomPriceFeedMessage(
        uint numPriceFeeds
    ) internal returns (PriceFeedMessage[] memory priceFeedMessages) {
        priceFeedMessages = new PriceFeedMessage[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i] = PriceFeedMessage({
                priceId: getRandBytes32(),
                price: getRandInt64(),
                conf: getRandUint64(),
                expo: getRandInt32(),
                publishTime: getRandUint64(),
                emaPrice: getRandInt64(),
                emaConf: getRandUint64()
            });
        }
    }

    function createWormholeMerkleUpdateData(
        PriceFeedMessage[] memory priceFeedMessages
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        updateData = new bytes[](1);

        uint8 depth = 0;
        while ((1 << depth) < priceFeedMessages.length) {
            depth++;
        }

        depth += getRandUint8() % 3;

        updateData[0] = generateWhMerkleUpdate(priceFeedMessages, depth, 1);

        updateFee = pyth.getUpdateFee(updateData);
    }

    /// Testing update price feeds method using wormhole merkle update type.
    function testUpdatePriceFeedWithWormholeMerkleWorks(uint seed) public {
        setRandSeed(seed);

        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                (getRandUint() % 10) + 1
            );
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            PythStructs.Price memory aggregatePrice = pyth.getPriceUnsafe(
                priceFeedMessages[i].priceId
            );
            assertEq(aggregatePrice.price, priceFeedMessages[i].price);
            assertEq(aggregatePrice.conf, priceFeedMessages[i].conf);
            assertEq(aggregatePrice.expo, priceFeedMessages[i].expo);
            assertEq(
                aggregatePrice.publishTime,
                priceFeedMessages[i].publishTime
            );

            PythStructs.Price memory emaPrice = pyth.getEmaPriceUnsafe(
                priceFeedMessages[i].priceId
            );
            assertEq(emaPrice.price, priceFeedMessages[i].emaPrice);
            assertEq(emaPrice.conf, priceFeedMessages[i].emaConf);
            assertEq(emaPrice.expo, priceFeedMessages[i].expo);
            assertEq(emaPrice.publishTime, priceFeedMessages[i].publishTime);
        }
    }

    function testUpdatePriceFeedWithWormholeMerkleWorksOnMultiUpdate() public {}

    function testUpdatePriceFeedWithWormholeMerkleIgnoresOutOfOrderUpdate()
        public
    {}

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAA() public {}

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAASource()
        public
    {}

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongProof()
        public
    {}

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongHeader()
        public
    {}

    function testUpdatePriceFeedWithWormholeMerkleRevertsIfUpdateFeeIsNotPaid()
        public
    {}
}
