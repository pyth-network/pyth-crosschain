// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PriceUpdater {
    event PriceUpdate(
        int64 publish_time,
        bytes32[] price_ids,
        bytes client_context
    );

    function emitPriceUpdate(
        int64 publish_time,
        bytes32[] calldata price_ids,
        bytes calldata client_context
    ) external {
        emit PriceUpdate(publish_time, price_ids, client_context);
    }
}
