// SPDX-License-Identifier: UNLICENSED
// Copyright (C) 2024 Lavra Holdings Limited - All Rights Reserved
pragma solidity ^0.8.0;

interface IPERFeeReceiver {
    // Receive the proceeds of an auction.
    // @param permissionKey The permission key where the auction was conducted on.
    function receiveAuctionProceedings(
        bytes calldata permissionKey
    ) external payable;
}
