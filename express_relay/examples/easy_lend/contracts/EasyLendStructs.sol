// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.13;

struct Vault {
    address tokenCollateral;
    address tokenDebt;
    uint256 amountCollateral;
    uint256 amountDebt;
    uint256 minHealthRatio; // 10**18 is 100%
    uint256 minPermissionlessHealthRatio;
    bytes32 tokenPriceFeedIdCollateral;
    bytes32 tokenPriceFeedIdDebt;
}
