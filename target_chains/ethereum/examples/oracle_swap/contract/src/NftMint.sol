// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IEntropy.sol";

import "./EntropyStructs.sol";
// TODO
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract NftMint {
    event Transfer(address from, address to, uint amountUsd, uint amountWei);

    IEntropy entropy;

    ERC20 public baseToken;

    constructor(
        address _entropy,
        address _baseToken,
    ) {
        entropy = IPyth(_entropy);
    }

    function requestMint(
      bytes32 userCommitment
    ) payable external {
      uint256 fee = entropy.getFee(provider);
      uint64 sequenceNumber = entropy.request{value: fee}(provider, userCommitment, true);
      requestedMints[sequenceNumber] = msg.sender;
    }

    function revealMint(
      uint64 sequenceNumber,
      bytes32 userRandom,
      bytes32 providerRandom
    ) {
      if (requestedMints[sequenceNumber] != msg.sender) revert;


    }

    // Reinitialize the parameters of this contract.
    // (This function is for demo purposes only. You wouldn't include this on a real contract.)
    function reinitialize(
        bytes32 _baseTokenPriceId,
        bytes32 _quoteTokenPriceId,
        address _baseToken,
        address _quoteToken
    ) external {
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    receive() external payable {}
}
