// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/Prng.sol";

contract PrngTest is Test {

    function testBasic() public {
        PrngState memory state = PrngState(0);
        (PrngState memory nextState, uint draw) = Prng.next(state);

        assertEq(nextState.rand, keccak256(abi.encodePacked(draw)));
    }

    // TODO: Test random properties of output
    function testFuzzDraw(bytes32 seed) public {
        PrngState memory state = PrngState(seed);

        (PrngState memory nextState, uint draw) = Prng.draw(state, 10);
        assert(draw < 10);
    }
}
