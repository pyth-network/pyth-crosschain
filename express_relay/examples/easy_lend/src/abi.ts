// This is only a subset of the generated abi necessary for the monitor script
export const abi = [
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
    name: "getVault",
    inputs: [
      {
        name: "vaultId",
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
            name: "tokenIdCollateral",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "tokenIdDebt",
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
    name: "liquidate",
    inputs: [
      {
        name: "vaultId",
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
        name: "vaultId",
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
    name: "UncollateralizedVaultCreation",
    inputs: [],
  },
] as const;
