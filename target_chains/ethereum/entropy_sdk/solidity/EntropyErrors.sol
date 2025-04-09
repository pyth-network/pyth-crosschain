// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library EntropyErrors {
    // An invariant of the contract failed to hold. This error indicates a software logic bug.
    // Signature: 0xd82dd966
    error AssertionFailure();
    // The provider being registered has already registered
    // Signature: 0xda041bdf
    error ProviderAlreadyRegistered();
    // The requested provider does not exist.
    // Signature: 0xdf51c431
    error NoSuchProvider();
    // The specified request does not exist.
    // Signature: 0xc4237352
    error NoSuchRequest();
    // The randomness provider is out of commited random numbers. The provider needs to
    // rotate their on-chain commitment to resolve this error.
    // Signature: 0x3e515085
    error OutOfRandomness();
    // The transaction fee was not sufficient
    // Signature: 0x025dbdd4
    error InsufficientFee();
    // Either the user's or the provider's revealed random values did not match their commitment.
    // Signature: 0xb8be1a8d
    error IncorrectRevelation();
    // Governance message is invalid (e.g., deserialization error).
    // Signature: 0xb463ce7a
    error InvalidUpgradeMagic();
    // The msg.sender is not allowed to invoke this call.
    // Signature: 0x82b42900
    error Unauthorized();
    // The blockhash is 0.
    // Signature: 0x92555c0e
    error BlockhashUnavailable();
    // if a request was made using `requestWithCallback`, request should be fulfilled using `revealWithCallback`
    // else if a request was made using `request`, request should be fulfilled using `reveal`
    // Signature: 0x50f0dc92
    error InvalidRevealCall();
    // The last random number revealed from the provider is too old. Therefore, too many hashes
    // are required for any new reveal. Please update the currentCommitment before making more requests.
    error LastRevealedTooOld();
    // A more recent commitment is already revealed on-chain
    error UpdateTooOld();
    // Not enough gas was provided to the function to execute the callback with the desired amount of gas.
    error InsufficientGas();
    // A gas limit value was provided that was greater than the maximum possible limit of 655,350,000
    error MaxGasLimitExceeded();
}
