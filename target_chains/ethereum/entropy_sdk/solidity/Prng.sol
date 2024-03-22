// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/// A pseudorandom number generator powered by a seed.
/// This 
library Prng {
    uint256 public constant MAX_UINT_256 = (uint256) (~(uint256)(0));

    function next(PrngState memory state) public returns (PrngState memory nextState, uint256 val) {
        val = (uint256) (state.rand);
        nextState = PrngState(keccak256(abi.encodePacked((state.rand))));
    }

    function draw(PrngState memory state, uint256 max) public returns (PrngState memory nextState, uint256 val) {
        uint256 bits;
        nextState = state;
        do {
            (nextState, bits) = next(nextState);
            val = bits % max;
            // FIXME: check boundary condition. this may be off by 1
        } while (bits - val > MAX_UINT_256 - max);
    }
}

struct PrngState {
    bytes32 rand;
}
