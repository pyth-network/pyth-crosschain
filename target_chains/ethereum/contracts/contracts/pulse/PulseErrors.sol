// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

error NoSuchProvider();
error NoSuchRequest();
error InsufficientFee();
error Unauthorized();
error InvalidCallbackGas();
error CallbackFailed();
error InvalidPriceIds(bytes32 providedPriceIdsHash, bytes32 storedPriceIdsHash);
error InvalidCallbackGasLimit(uint256 requested, uint256 stored);
error ExceedsMaxPrices(uint32 requested, uint32 maxAllowed);
error InsufficientGas();
