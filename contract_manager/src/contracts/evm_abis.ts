import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import EntropyAbi from "@pythnetwork/entropy-sdk-solidity/abis/IEntropy.json";

export const OWNABLE_ABI = [
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingOwner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any

export const EXPRESS_RELAY_ABI = [
  {
    type: "function",
    name: "getAdmin",
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
    name: "getFeeProtocol",
    inputs: [
      {
        name: "feeRecipient",
        type: "address",
        internalType: "address",
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
    name: "getFeeProtocolDefault",
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
    name: "getFeeRelayer",
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
    name: "getFeeSplitPrecision",
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
    name: "getRelayer",
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
    name: "getRelayerSubwallets",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setFeeProtocol",
    inputs: [
      {
        name: "feeRecipient",
        type: "address",
        internalType: "address",
      },
      {
        name: "feeSplit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeProtocolDefault",
    inputs: [
      {
        name: "feeSplit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeRelayer",
    inputs: [
      {
        name: "feeSplit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setRelayer",
    inputs: [
      {
        name: "relayer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  ...OWNABLE_ABI,
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any

export const EXTENDED_ENTROPY_ABI = [
  {
    inputs: [],
    name: "acceptAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  ...OWNABLE_ABI,
  ...EntropyAbi,
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any
export const EXTENDED_PYTH_ABI = [
  {
    inputs: [],
    name: "wormhole",
    outputs: [
      {
        internalType: "contract IWormhole",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "governanceDataSource",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "chainId",
            type: "uint16",
          },
          {
            internalType: "bytes32",
            name: "emitterAddress",
            type: "bytes32",
          },
        ],
        internalType: "struct PythInternalStructs.DataSource",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "encodedVM",
        type: "bytes",
      },
    ],
    name: "executeGovernanceInstruction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "singleUpdateFeeInWei",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "validDataSources",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "chainId",
            type: "uint16",
          },
          {
            internalType: "bytes32",
            name: "emitterAddress",
            type: "bytes32",
          },
        ],
        internalType: "struct PythInternalStructs.DataSource[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
    constant: true,
  },
  {
    inputs: [],
    name: "lastExecutedGovernanceSequence",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "priceFeedExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  ...PythInterfaceAbi,
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any
export const WORMHOLE_ABI = [
  {
    inputs: [],
    name: "getCurrentGuardianSetIndex",
    outputs: [
      {
        internalType: "uint32",
        name: "",
        type: "uint32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "chainId",
    outputs: [
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "index",
        type: "uint32",
      },
    ],
    name: "getGuardianSet",
    outputs: [
      {
        components: [
          {
            internalType: "address[]",
            name: "keys",
            type: "address[]",
          },
          {
            internalType: "uint32",
            name: "expirationTime",
            type: "uint32",
          },
        ],
        internalType: "struct Structs.GuardianSet",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_vm",
        type: "bytes",
      },
    ],
    name: "submitNewGuardianSet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "messageFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any
export const EXECUTOR_ABI = [
  {
    inputs: [
      {
        internalType: "bytes",
        name: "encodedVm",
        type: "bytes",
      },
    ],
    name: "execute",
    outputs: [
      {
        internalType: "bytes",
        name: "response",
        type: "bytes",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getOwnerChainId",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getOwnerEmitterAddress",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLastExecutedSequence",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any

export const PULSE_UPGRADEABLE_ABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "MAX_PRICE_IDS",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "NUM_REQUESTS",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "NUM_REQUESTS_MASK",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes1",
        internalType: "bytes1",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "acceptOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeCallback",
    inputs: [
      {
        name: "sequenceNumber",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "updateData",
        type: "bytes[]",
        internalType: "bytes[]",
      },
      {
        name: "priceIds",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getAccruedFees",
    inputs: [],
    outputs: [
      {
        name: "accruedFeesInWei",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDefaultProvider",
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
    name: "getExclusivityPeriod",
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
    name: "getFee",
    inputs: [
      {
        name: "callbackGasLimit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "feeAmount",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFirstActiveRequests",
    inputs: [
      {
        name: "count",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "requests",
        type: "tuple[]",
        internalType: "struct PulseState.Request[]",
        components: [
          {
            name: "sequenceNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "publishTime",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "priceIds",
            type: "bytes32[10]",
            internalType: "bytes32[10]",
          },
          {
            name: "numPriceIds",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "callbackGasLimit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requester",
            type: "address",
            internalType: "address",
          },
          {
            name: "provider",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "actualCount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProviderInfo",
    inputs: [
      {
        name: "provider",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PulseState.ProviderInfo",
        components: [
          {
            name: "feeInWei",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "accruedFeesInWei",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "feeManager",
            type: "address",
            internalType: "address",
          },
          {
            name: "isRegistered",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPythFeeInWei",
    inputs: [],
    outputs: [
      {
        name: "pythFeeInWei",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRequest",
    inputs: [
      {
        name: "sequenceNumber",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [
      {
        name: "req",
        type: "tuple",
        internalType: "struct PulseState.Request",
        components: [
          {
            name: "sequenceNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "publishTime",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "priceIds",
            type: "bytes32[10]",
            internalType: "bytes32[10]",
          },
          {
            name: "numPriceIds",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "callbackGasLimit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requester",
            type: "address",
            internalType: "address",
          },
          {
            name: "provider",
            type: "address",
            internalType: "address",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "admin",
        type: "address",
        internalType: "address",
      },
      {
        name: "pythFeeInWei",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "pythAddress",
        type: "address",
        internalType: "address",
      },
      {
        name: "defaultProvider",
        type: "address",
        internalType: "address",
      },
      {
        name: "prefillRequestStorage",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "exclusivityPeriodSeconds",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
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
    name: "pendingOwner",
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
    name: "proxiableUUID",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerProvider",
    inputs: [
      {
        name: "feeInWei",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestPriceUpdatesWithCallback",
    inputs: [
      {
        name: "publishTime",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "priceIds",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
      {
        name: "callbackGasLimit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "requestSequenceNumber",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setDefaultProvider",
    inputs: [
      {
        name: "provider",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setExclusivityPeriod",
    inputs: [
      {
        name: "periodSeconds",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeManager",
    inputs: [
      {
        name: "manager",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setProviderFee",
    inputs: [
      {
        name: "newFeeInWei",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "upgradeTo",
    inputs: [
      {
        name: "newImplementation",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "upgradeToAndCall",
    inputs: [
      {
        name: "newImplementation",
        type: "address",
        internalType: "address",
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "version",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "withdrawAsFeeManager",
    inputs: [
      {
        name: "provider",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawFees",
    inputs: [
      {
        name: "amount",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AdminChanged",
    inputs: [
      {
        name: "previousAdmin",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "newAdmin",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BeaconUpgraded",
    inputs: [
      {
        name: "beacon",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ContractUpgraded",
    inputs: [
      {
        name: "oldImplementation",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "newImplementation",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DefaultProviderUpdated",
    inputs: [
      {
        name: "oldProvider",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "newProvider",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ExclusivityPeriodUpdated",
    inputs: [
      {
        name: "oldPeriodSeconds",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "newPeriodSeconds",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeeManagerUpdated",
    inputs: [
      {
        name: "admin",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "oldFeeManager",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "newFeeManager",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeesWithdrawn",
    inputs: [
      {
        name: "recipient",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint128",
        indexed: false,
        internalType: "uint128",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Initialized",
    inputs: [
      {
        name: "version",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferStarted",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PriceUpdateCallbackFailed",
    inputs: [
      {
        name: "sequenceNumber",
        type: "uint64",
        indexed: true,
        internalType: "uint64",
      },
      {
        name: "provider",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "priceIds",
        type: "bytes32[]",
        indexed: false,
        internalType: "bytes32[]",
      },
      {
        name: "requester",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "reason",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PriceUpdateExecuted",
    inputs: [
      {
        name: "sequenceNumber",
        type: "uint64",
        indexed: true,
        internalType: "uint64",
      },
      {
        name: "provider",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "priceIds",
        type: "bytes32[]",
        indexed: false,
        internalType: "bytes32[]",
      },
      {
        name: "prices",
        type: "int64[]",
        indexed: false,
        internalType: "int64[]",
      },
      {
        name: "conf",
        type: "uint64[]",
        indexed: false,
        internalType: "uint64[]",
      },
      {
        name: "expos",
        type: "int32[]",
        indexed: false,
        internalType: "int32[]",
      },
      {
        name: "publishTimes",
        type: "uint256[]",
        indexed: false,
        internalType: "uint256[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PriceUpdateRequested",
    inputs: [
      {
        name: "request",
        type: "tuple",
        indexed: false,
        internalType: "struct PulseState.Request",
        components: [
          {
            name: "sequenceNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "publishTime",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "priceIds",
            type: "bytes32[10]",
            internalType: "bytes32[10]",
          },
          {
            name: "numPriceIds",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "callbackGasLimit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requester",
            type: "address",
            internalType: "address",
          },
          {
            name: "provider",
            type: "address",
            internalType: "address",
          },
        ],
      },
      {
        name: "priceIds",
        type: "bytes32[]",
        indexed: false,
        internalType: "bytes32[]",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProviderFeeUpdated",
    inputs: [
      {
        name: "provider",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "oldFee",
        type: "uint128",
        indexed: false,
        internalType: "uint128",
      },
      {
        name: "newFee",
        type: "uint128",
        indexed: false,
        internalType: "uint128",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProviderRegistered",
    inputs: [
      {
        name: "provider",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "feeInWei",
        type: "uint128",
        indexed: false,
        internalType: "uint128",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Upgraded",
    inputs: [
      {
        name: "implementation",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "InsufficientFee",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPriceIds",
    inputs: [
      {
        name: "providedPriceIdsHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "storedPriceIdsHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "NoSuchRequest",
    inputs: [],
  },
  {
    type: "error",
    name: "TooManyPriceIds",
    inputs: [
      {
        name: "provided",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maximum",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any
