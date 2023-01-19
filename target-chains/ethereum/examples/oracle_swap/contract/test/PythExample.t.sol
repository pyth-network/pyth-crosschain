// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/PythExample.sol";
import "pyth-sdk-solidity/MockPyth.sol";

contract PythExampleTest is Test {
    PythExample public pythExample;
    MockPyth public mockPyth;

    bytes32 constant ETH_DUMMY_PRICE_ID =
        0x000000000000000000000000000000000000000000000000000000000000abcd;
    address payable constant DUMMY_TO =
        payable(0x0000000000000000000000000000000000000055);

    function setUp() public {
        // Creating a mock of Pyth contract with 60 seconds validTimePeriod (for staleness)
        // and 1 wei fee for updating the price.
        mockPyth = new MockPyth(60, 1);

        pythExample = new PythExample(address(mockPyth), ETH_DUMMY_PRICE_ID);
    }

    function testSendToFriend(uint128 _amountInUsd) public {
        bytes[] memory updateData = new bytes[](1);

        // This is a dummy update data for Eth. It shows the price as $1000 +- $10 (with -5 exponent).
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_DUMMY_PRICE_ID,
            1000 * 100000,
            10 * 100000,
            -5,
            1000 * 100000,
            10 * 100000,
            uint64(block.timestamp)
        );

        // As the ETH price is 1000$ the transferred value is _amountInUsd / 1000 ETH which is
        // _amountInUsd * 10**15 wei
        uint value = uint(_amountInUsd) *
            10 ** 15 +
            mockPyth.getUpdateFee(updateData.length);

        // Make sure the contract has enough funds
        vm.deal(address(this), value);

        pythExample.sendToFriend{value: value}(
            DUMMY_TO,
            _amountInUsd,
            updateData
        );
    }

    receive() external payable {}
}
