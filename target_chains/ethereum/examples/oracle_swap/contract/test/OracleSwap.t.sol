// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/OracleSwap.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
import "openzeppelin-contracts/contracts/mocks/ERC20Mock.sol";

contract OracleSwapTest is Test {
    MockPyth public mockPyth;

    bytes32 constant BASE_PRICE_ID =
        0x000000000000000000000000000000000000000000000000000000000000abcd;
    bytes32 constant QUOTE_PRICE_ID =
        0x0000000000000000000000000000000000000000000000000000000000001234;

    ERC20Mock baseToken;
    address payable constant BASE_TOKEN_MINT =
        payable(0x0000000000000000000000000000000000000011);
    ERC20Mock quoteToken;
    address payable constant QUOTE_TOKEN_MINT =
        payable(0x0000000000000000000000000000000000000022);

    OracleSwap public swap;

    uint256 MAX_INT = 2 ** 256 - 1;

    address swapper = address(1);
    address updater = address(2);

    function setUp() public {
        // Creating a mock of Pyth contract with 60 seconds validTimePeriod (for staleness)
        // and 1 wei fee for updating the price.
        mockPyth = new MockPyth(60, 1);

        baseToken = new ERC20Mock(
            "Foo token",
            "FOO",
            BASE_TOKEN_MINT,
            1000 * 10 ** 18
        );
        quoteToken = new ERC20Mock(
            "Bar token",
            "BAR",
            QUOTE_TOKEN_MINT,
            1000 * 10 ** 18
        );

        swap = new OracleSwap(
            address(mockPyth),
            BASE_PRICE_ID,
            QUOTE_PRICE_ID,
            address(baseToken),
            address(quoteToken)
        );
    }

    function setupTokens(
        uint senderBaseQty,
        uint senderQuoteQty,
        uint poolBaseQty,
        uint poolQuoteQty
    ) private {
        baseToken.mint(address(swapper), senderBaseQty);
        quoteToken.mint(address(swapper), senderQuoteQty);

        vm.prank(swapper);
        baseToken.approve(address(swap), MAX_INT);
        vm.prank(swapper);
        quoteToken.approve(address(swap), MAX_INT);

        baseToken.mint(address(swap), poolBaseQty);
        quoteToken.mint(address(swap), poolQuoteQty);
    }

    function doSwap(
        int32 basePrice,
        int32 quotePrice,
        bool isBuy,
        uint size
    ) private {
        bytes[] memory updateData = new bytes[](2);

        // This is a dummy update data for Eth. It shows the price as $1000 +- $10 (with -5 exponent).
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            BASE_PRICE_ID,
            basePrice * 100000,
            10 * 100000,
            -5,
            basePrice * 100000,
            10 * 100000,
            uint64(block.timestamp)
        );
        updateData[1] = mockPyth.createPriceFeedUpdateData(
            QUOTE_PRICE_ID,
            quotePrice * 100000,
            10 * 100000,
            -5,
            quotePrice * 100000,
            10 * 100000,
            uint64(block.timestamp)
        );

        // Make sure the contract has enough funds to update the pyth feeds
        uint value = mockPyth.getUpdateFee(updateData);
        vm.deal(address(swapper), value);

        vm.prank(swapper);
        swap.swap{value: value}(isBuy, size, updateData);
    }

    function testSwap() public {
        setupTokens(20e18, 20e18, 20e18, 20e18);

        doSwap(10, 1, true, 1e18);

        assertEq(quoteToken.balanceOf(address(swapper)), 10e18 - 1);
        assertEq(baseToken.balanceOf(address(swapper)), 21e18);

        doSwap(10, 1, false, 1e18);

        assertEq(quoteToken.balanceOf(address(swapper)), 20e18 - 1);
        assertEq(baseToken.balanceOf(address(swapper)), 20e18);
    }

    function doSwapNoUpdate(
        int32 basePrice,
        int32 quotePrice,
        bool isBuy,
        uint size
    ) private {
        bytes[] memory updateData = new bytes[](2);

        // This is a dummy update data for Eth. It shows the price as $1000 +- $10 (with -5 exponent).
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            BASE_PRICE_ID,
            basePrice * 100000,
            10 * 100000,
            -5,
            basePrice * 100000,
            10 * 100000,
            uint64(block.timestamp)
        );
        updateData[1] = mockPyth.createPriceFeedUpdateData(
            QUOTE_PRICE_ID,
            quotePrice * 100000,
            10 * 100000,
            -5,
            quotePrice * 100000,
            10 * 100000,
            uint64(block.timestamp)
        );

        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = BASE_PRICE_ID;
        priceIds[1] = QUOTE_PRICE_ID;

        vm.deal(swapper, 1 ether);
        vm.deal(updater, 1 ether);

        uint tip = 9;

        vm.expectRevert(
            abi.encodeWithSelector(
                PythErrors.RequirePriceFeeds.selector,
                priceIds,
                tip
            )
        );
        vm.prank(swapper);
        swap.swapNoUpdate{value: tip}(isBuy, size);

        uint updateFee = mockPyth.getUpdateFee(updateData);

        vm.prank(updater);
        mockPyth.updatePriceFeedsOnBehalfOf{value: updateFee}(
            tx.origin,
            priceIds,
            updateData
        );

        uint updaterInitialBalance = updater.balance;
        uint swapperInitialBalance = swapper.balance;

        vm.prank(swapper);
        swap.swapNoUpdate{value: tip}(isBuy, size);

        assertEq(swapperInitialBalance - tip, swapper.balance);
        assertEq(updaterInitialBalance + tip, updater.balance);
    }

    function testSwapNoUpdate() public {
        setupTokens(20e18, 20e18, 20e18, 20e18);

        doSwapNoUpdate(10, 1, true, 1e18);

        assertEq(quoteToken.balanceOf(address(swapper)), 10e18 - 1);
        assertEq(baseToken.balanceOf(address(swapper)), 21e18);
    }

    function testWithdraw() public {
        setupTokens(10e18, 10e18, 10e18, 10e18);

        vm.prank(swapper);
        swap.withdrawAll();

        assertEq(quoteToken.balanceOf(address(swapper)), 20e18);
        assertEq(baseToken.balanceOf(address(swapper)), 20e18);
        assertEq(quoteToken.balanceOf(address(swap)), 0);
        assertEq(baseToken.balanceOf(address(swap)), 0);
    }

    receive() external payable {}
}
