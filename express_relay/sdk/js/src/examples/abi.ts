export const abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "expressRelayAddress",
        type: "address",
        internalType: "address",
      },
      {
        name: "oracleAddress",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "receive",
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "createVault",
    inputs: [
      {
        name: "tokenCollateral",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenDebt",
        type: "address",
        internalType: "address",
      },
      {
        name: "amountCollateral",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "amountDebt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minHealthRatio",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minPermissionLessHealthRatio",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "tokenIDCollateral",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "tokenIDDebt",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "updateData",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "expressRelay",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastVaultId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOracle",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVault",
    inputs: [
      {
        name: "vaultID",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Vault",
        components: [
          {
            name: "tokenCollateral",
            type: "address",
            internalType: "address",
          },
          {
            name: "tokenDebt",
            type: "address",
            internalType: "address",
          },
          {
            name: "amountCollateral",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "amountDebt",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minHealthRatio",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minPermissionLessHealthRatio",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "tokenIDCollateral",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "tokenIDDebt",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVaultHealth",
    inputs: [
      {
        name: "vaultID",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidate",
    inputs: [
      {
        name: "vaultID",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "liquidateWithPriceUpdate",
    inputs: [
      {
        name: "vaultID",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "updateData",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "receiveAuctionProceedings",
    inputs: [
      {
        name: "permissionKey",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "updateVault",
    inputs: [
      {
        name: "vaultID",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "deltaCollateral",
        type: "int256",
        internalType: "int256",
      },
      {
        name: "deltaDebt",
        type: "int256",
        internalType: "int256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "VaultReceivedETH",
    inputs: [
      {
        name: "sender",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "permissionKey",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AddressEmptyCode",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "AddressInsufficientBalance",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "FailedInnerCall",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidHealthRatios",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidLiquidation",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPriceExponent",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidVaultUpdate",
    inputs: [],
  },
  {
    type: "error",
    name: "NegativePrice",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "UncollateralizedVaultCreation",
    inputs: [],
  },
] as const;
