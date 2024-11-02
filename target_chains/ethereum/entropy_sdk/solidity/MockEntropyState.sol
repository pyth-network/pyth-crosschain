// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

contract EntropyInternalStructs {
  struct State {
    address admin;
    uint128 pythFeeInWei;
    uint128 accruedPythFeesInWei;
    address defaultProvider;
    EntropyStructs.Request[32] requests;
    mapping(bytes32 => EntropyStructs.Request) requestsOverflow;
    mapping(address => EntropyStructs.ProviderInfo) providers;
    address proposedAdmin;
  }
}

contract MockEntropyState {
  uint8 public constant NUM_REQUESTS = 32;
  bytes1 public constant NUM_REQUESTS_MASK = 0x1f;
  EntropyInternalStructs.State _state;
}
