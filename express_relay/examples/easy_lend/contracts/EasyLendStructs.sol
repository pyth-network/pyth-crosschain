// Copyright (C) 2024 Lavra Holdings Limited - All Rights Reserved
pragma solidity ^0.8.13;

struct Vault {
    address tokenCollateral;
    address tokenDebt;
    uint256 amountCollateral;
    uint256 amountDebt;
    uint256 minHealthRatio; // 10**18 is 100%
    uint256 minPermissionlessHealthRatio;
    bytes32 tokenIdCollateral;
    bytes32 tokenIdDebt;
}
