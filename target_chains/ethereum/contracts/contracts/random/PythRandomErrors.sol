// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

// FIXME: comments
library PythRandomErrors {
    // Function arguments are invalid (e.g., the arguments lengths mismatch)
    // Signature: TODO
    error ProviderAlreadyRegistered();

    error NoSuchProvider();

    // Update data is coming from an invalid data source.
    // Signature: TODO
    error OutOfRandomness();
    // Update data is coming from an invalid data source.
    // Signature: TODO
    error InsufficientFee();

    error IncorrectUserRevelation();
    error IncorrectProviderRevelation();
}
