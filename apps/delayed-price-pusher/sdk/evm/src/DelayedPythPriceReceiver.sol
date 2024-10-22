// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface DelayedPythPriceReceiver {
    event RequestPythPrice(
        uint256 priceFeedId,
        uint8 delaySeconds,
        bytes context
    );

    function notifyPythPrice(
        bytes calldata update,
        bytes calldata context
    ) external;
}
