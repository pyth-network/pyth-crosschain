// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IPyth.sol";
import "forge-std/console2.sol";

abstract contract PythMulticall {
    function pythAddress() internal virtual returns (address pyth);

    function updateFeedsAndCall(
        bytes[] calldata priceUpdateData,
        bytes calldata data
    ) public payable returns (bytes memory response) {
        console2.log(msg.sender);
        updatePythPriceFeeds(priceUpdateData);

        nonPayableSample();

        bool success;
        // (success, response) = address(this).delegatecall{value: 0}(data);
        (success, response) = address(this).{value: 0}(data);

        // Check if the call was successful or not.
        if (!success) {
            // If there is return data, the delegate call reverted with a reason or a custom error, which we bubble up.
            if (response.length > 0) {
                assembly {
                    let returndata_size := mload(response)
                    revert(add(32, response), returndata_size)
                }
            } else {
                // FIXME
                revert("TODO");
            }
        }
    }

    function updatePythPriceFeeds(
        bytes[] calldata priceUpdateData
    ) public payable {
        console2.log("updatePythPriceFeeds");
        console2.log(msg.sender);
        console2.log(msg.value);

        IPyth pyth = IPyth(pythAddress());

        // Update the prices to the latest available values and pay the required fee for it. The `priceUpdateData` data
        // should be retrieved from our off-chain Price Service API using the `pyth-evm-js` package.
        // See section "How Pyth Works on EVM Chains" below for more information.
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
    }

    function nonPayableSample() public {
        console2.log("nonpayableSample");
        console2.log(msg.sender);
    }
}
