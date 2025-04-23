// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../contracts/echo/IEcho.sol";
import "./MockPriceFeedTestUtils.sol";

abstract contract EchoTestUtils is Test, MockPriceFeedTestUtils {
    // Helper function to setup consumer request
    function setupConsumerRequest(
        IEcho echo,
        address provider,
        address consumerAddress
    )
        internal
        returns (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint64 publishTime
        )
    {
        priceIds = createPriceIds();
        publishTime = SafeCast.toUint64(block.timestamp);
        vm.deal(consumerAddress, 1 gwei);

        uint96 totalFee = echo.getFee(provider, CALLBACK_GAS_LIMIT, priceIds);

        vm.prank(consumerAddress);
        sequenceNumber = echo.requestPriceUpdatesWithCallback{value: totalFee}(
            provider,
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        return (sequenceNumber, priceIds, publishTime);
    }
}
