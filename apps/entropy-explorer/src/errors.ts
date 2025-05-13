export const ERROR_DETAILS = {
  "0xd82dd966": [
    "AssertionFailure",
    "An invariant of the contract failed to hold. This error indicates a software logic bug.",
  ],
  "0xda041bdf": [
    "ProviderAlreadyRegistered",
    "The provider being registered has already registered",
  ],
  "0xdf51c431": ["NoSuchProvider", "The requested provider does not exist."],
  "0xc4237352": ["NoSuchRequest", "The specified request does not exist."],
  "0x3e515085": [
    "OutOfRandomness",
    "The randomness provider is out of commited random numbers. The provider needs to rotate their on-chain commitment to resolve this error.",
  ],
  "0x025dbdd4": ["InsufficientFee", "The transaction fee was not sufficient"],
  "0xb8be1a8d": [
    "IncorrectRevelation",
    "Either the user's or the provider's revealed random values did not match their commitment.",
  ],
  "0xb463ce7a": [
    "InvalidUpgradeMagic",
    "Governance message is invalid (e.g., deserialization error).",
  ],
  "0x82b42900": [
    "Unauthorized",
    "The msg.sender is not allowed to invoke this call.",
  ],
  "0x92555c0e": ["BlockhashUnavailable", "The blockhash is 0."],
  "0x50f0dc92": [
    "InvalidRevealCall",
    "if a request was made using `requestWithCallback`, request should be fulfilled using `revealWithCallback` else if a request was made using `request`, request should be fulfilled using `reveal`",
  ],
  "0xb28d9c76": [
    "LastRevealedTooOld",
    "The last random number revealed from the provider is too old. Therefore, too many hashes are required for any new reveal. Please update the currentCommitment before making more requests.",
  ],
  "0x5e5b3f1b": [
    "UpdateTooOld",
    "A more recent commitment is already revealed on-chain",
  ],
  "0x1c26714c": [
    "InsufficientGas",
    "Not enough gas was provided to the function to execute the callback with the desired amount of gas.",
  ],
  "0x9376b93b": [
    "MaxGasLimitExceeded",
    "A gas limit value was provided that was greater than the maximum possible limit of 655,350,000",
  ],
} as const;

export const getErrorDetails = (error: string) =>
  (ERROR_DETAILS as Record<string, readonly [string, string]>)[error];
