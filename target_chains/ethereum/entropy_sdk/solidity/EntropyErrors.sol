// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library EntropyErrors {
    // An invariant of the contract failed to hold. This error indicates a software logic bug.
    error AssertionFailure();
    // The provider being registered has already registered
    // Signature: TODO
    error ProviderAlreadyRegistered();
    // The requested provider does not exist.
    error NoSuchProvider();
    // The randomness provider is out of commited random numbers. The provider needs to
    // rotate their on-chain commitment to resolve this error.
    error OutOfRandomness();
    // The transaction fee was not sufficient
    error InsufficientFee();
    // The user's revealed random value did not match their commitment.
    // FIXME rename and delete the one below
    error IncorrectUserRevelation();
    // The provider's revealed random value did not match their commitment.
    error IncorrectProviderRevelation();
}
