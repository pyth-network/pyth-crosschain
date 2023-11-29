// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract UUPSProxy is ERC1967Proxy {
    constructor(
        address _implementation,
        bytes memory _data
    ) ERC1967Proxy(_implementation, _data) {}
}
