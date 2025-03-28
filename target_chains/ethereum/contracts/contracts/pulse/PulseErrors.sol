// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

error NoSuchProvider();
error NoSuchRequest();
// TODO: add expected / provided values
error InsufficientFee();
error Unauthorized();
error InvalidCallbackGas();
error CallbackFailed();
error InvalidPriceIds(bytes32 providedPriceId, bytes8 storedPriceId);
error InvalidCallbackGasLimit(uint256 requested, uint256 stored);
error ExceedsMaxPrices(uint32 requested, uint32 maxAllowed);
error TooManyPriceIds(uint256 provided, uint256 maximum);
