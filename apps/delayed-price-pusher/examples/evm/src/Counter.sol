// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "delayed-price-pusher-sdk/DelayedPythPriceReceiver.sol";

contract Counter is DelayedPythPriceReceiver {
    uint256 public number;
    event CounterChanged(uint256 value);

    function setNumber(uint256 newNumber) public {
        number = newNumber;
        emit CounterChanged(number);
        emit RequestPythPrice(1, 2, "context");
    }

    function increment() public {
        number++;
        emit CounterChanged(number);
    }

    function notifyPythPrice(
        bytes calldata update,
        bytes calldata context
    ) external {
        // TODO: verify update
        uint256 a = uint256(uint8(update[0]));
        uint256 b = uint256(uint8(update[update.length - 1]));
        uint256 c = uint256(uint8(context[0]));
        uint256 d = uint256(uint8(context[context.length - 1]));
        number = a + b + c + d;
        emit CounterChanged(number);
    }
}
