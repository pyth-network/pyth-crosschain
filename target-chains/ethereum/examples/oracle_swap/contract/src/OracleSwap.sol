// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "pyth-sdk-solidity/IPyth.sol";
import "pyth-sdk-solidity/PythStructs.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract OracleSwap {
    event Transfer(address from, address to, uint amountUsd, uint amountWei);

    IPyth pyth;

    bytes32 baseTokenPriceId;
    bytes32 quoteTokenPriceId;

    ERC20 public baseToken;
    ERC20 public quoteToken;

    constructor(address _pyth, bytes32 _baseTokenPriceId, bytes32 _quoteTokenPriceId, address _baseToken, address _quoteToken) {
        pyth = IPyth(_pyth);
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    function swap(bool isBuy, uint size, bytes[] calldata updateData) external payable {
        uint updateFee = pyth.getUpdateFee(updateData.length);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        PythStructs.Price memory currentBasePrice = pyth.getPrice(baseTokenPriceId);
        PythStructs.Price memory currentQuotePrice = pyth.getPrice(quoteTokenPriceId);

        uint256 basePrice = convertToUint(currentBasePrice, baseToken.decimals());
        // Note: do all arithmetic in the base token's decimal quantity (which should be sufficient for the quote also)
        uint256 quotePrice = convertToUint(currentQuotePrice, baseToken.decimals());

        uint256 quoteSize = (size * basePrice) / quotePrice;

        if (isBuy) {
            quoteToken.transferFrom(msg.sender, address(this), quoteSize);
            baseToken.transfer(msg.sender, size);
        } else {
            baseToken.transferFrom(msg.sender, address(this), size);
            quoteToken.transfer(msg.sender, quoteSize);
        }
    }

    function convertToUint(PythStructs.Price memory price, uint8 targetDecimals) pure private returns (uint256) {
        if (price.price < 0 || price.expo > 0 || price.expo < -255) {
            revert();
        }

        uint8 priceDecimals = uint8(uint32(-1 * price.expo));

        if (targetDecimals - priceDecimals >= 0) {
            return uint(uint64(price.price)) * 10**uint32(targetDecimals - priceDecimals);
        } else {
            return uint(uint64(price.price)) / 10**uint32(priceDecimals - targetDecimals);
        }
    }

    function baseBalance() view public returns (uint256) {
        return baseToken.balanceOf(address(this));
    }

    function quoteBalance() view public returns (uint256) {
        return quoteToken.balanceOf(address(this));
    }

    // Helper functions for demo purposes only

    function withdrawAll() external {
        baseToken.transfer(msg.sender, baseToken.balanceOf(address(this)));
        quoteToken.transfer(msg.sender, quoteToken.balanceOf(address(this)));
    }

    function reinitialize(bytes32 _baseTokenPriceId, bytes32 _quoteTokenPriceId, address _baseToken, address _quoteToken) external {
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    receive() external payable {}
}
