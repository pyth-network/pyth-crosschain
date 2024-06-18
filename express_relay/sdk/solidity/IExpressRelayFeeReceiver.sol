// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

interface IExpressRelayFeeReceiver {
    // Receive the proceeds of an auction.
    // @param permissionKey The permission key where the auction was conducted on.
    function receiveAuctionProceedings(
        bytes calldata permissionKey
    ) external payable;
}
