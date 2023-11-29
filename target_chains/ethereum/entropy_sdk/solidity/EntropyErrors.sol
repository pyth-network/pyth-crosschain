// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library EntropyErrors {
    // An invariant of the contract failed to hold. This error indicates a software logic bug.
    error AssertionFailure();
    // The provider being registered has already registered
    error ProviderAlreadyRegistered();
    // The requested provider does not exist.
    error NoSuchProvider();
    // The specified request does not exist.
    error NoSuchRequest();
    // The randomness provider is out of commited random numbers. The provider needs to
    // rotate their on-chain commitment to resolve this error.
    error OutOfRandomness();
    // The transaction fee was not sufficient
    error InsufficientFee();
    // Either the user's or the provider's revealed random values did not match their commitment.
    error IncorrectRevelation();
}
