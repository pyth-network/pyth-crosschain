// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PriceUpdater {
    event PriceUpdate(
        uint256 publish_time,
        bytes32[] price_ids,
        bytes metadata
    );

    function emitPriceUpdate(
        uint256 publish_time,
        bytes32[] calldata price_ids,
        bytes calldata metadata
    ) external {
        emit PriceUpdate(publish_time, price_ids, metadata);
    }
}
