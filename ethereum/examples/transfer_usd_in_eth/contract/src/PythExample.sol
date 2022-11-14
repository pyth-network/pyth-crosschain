// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "pyth-sdk-solidity/IPyth.sol";
import "pyth-sdk-solidity/PythStructs.sol";

contract PythExample {
    event Transfer(address from, address to, uint amountUsd, uint amountWei);

    IPyth pyth;
    bytes32 ethPriceId;

    int32 constant ETH_IN_WEI_EXPO = 18;

    constructor(address _pyth, bytes32 _ethPriceId) {
        pyth = IPyth(_pyth);
        ethPriceId = _ethPriceId;
    }

    function sendToFriend(address payable to, uint amountUsd, bytes[] calldata updateData) external payable {
        uint updateFee = pyth.getUpdateFee(updateData.length);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        PythStructs.Price memory currentEthPrice = pyth.getPrice(ethPriceId);

        uint amountWei;

        require(currentEthPrice.price >= 0, "price should be positive");

        // amountUsd*10**(18-expo) / price

        if (ETH_IN_WEI_EXPO - currentEthPrice.expo >= 0) {
            amountWei = amountUsd * 10**uint32(ETH_IN_WEI_EXPO-currentEthPrice.expo) / uint(uint64(currentEthPrice.price));
        } else {
            amountWei = amountUsd / (uint(uint64(currentEthPrice.price)) * 10**uint32(currentEthPrice.expo - ETH_IN_WEI_EXPO));
        }

        require(msg.value - updateFee >= amountWei, "insufficient fee");

        to.transfer(amountWei);
        payable(msg.sender).transfer(msg.value - amountWei - updateFee);

        emit Transfer(msg.sender, to, amountUsd, amountWei);
    }
}
