// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IPyth.sol";

abstract contract PythMulticall {
    function pythAddress() private returns (address pythAddress);

    function updateFeedsAndCall(
        bytes[] calldata priceUpdateData,
        bytes calldata data
    ) public payable returns (bytes memory result) {
        updatePythPriceFeeds{value: msg.value}(priceUpdateData);
        return Address.functionDelegateCall(address(this), data);
    }

    function updatePythPriceFeeds(
        bytes[] calldata priceUpdateData
    ) public payable {
        IPyth pyth = IPyth(pythAddress());

        // Update the prices to the latest available values and pay the required fee for it. The `priceUpdateData` data
        // should be retrieved from our off-chain Price Service API using the `pyth-evm-js` package.
        // See section "How Pyth Works on EVM Chains" below for more information.
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
    }
}
