/* Autogenerated file. Do not edit manually. */

/* tslint:disable */
/* eslint-disable */

/*
  Fuels version: 0.89.2
  Forc version: 0.60.0
  Fuel-Core version: 0.27.0
*/

import { Interface, Contract, ContractFactory } from "fuels";
import type {
  Provider,
  Account,
  AbstractAddress,
  BytesLike,
  DeployContractOptions,
  StorageSlot,
} from "fuels";
import type {
  PythContractAbi,
  PythContractAbiInterface,
} from "../PythContractAbi";

const _abi = {
  encoding: "1",
  types: [
    {
      typeId: 0,
      type: "()",
      components: [],
      typeParameters: null,
    },
    {
      typeId: 1,
      type: "b256",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 2,
      type: "bool",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 3,
      type: "enum AccessError",
      components: [
        {
          name: "NotOwner",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 4,
      type: "enum GovernanceAction",
      components: [
        {
          name: "UpgradeContract",
          type: 0,
          typeArguments: null,
        },
        {
          name: "AuthorizeGovernanceDataSourceTransfer",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SetDataSources",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SetFee",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SetValidPeriod",
          type: 0,
          typeArguments: null,
        },
        {
          name: "RequestGovernanceDataSourceTransfer",
          type: 0,
          typeArguments: null,
        },
        {
          name: "Invalid",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 5,
      type: "enum GovernanceModule",
      components: [
        {
          name: "Executor",
          type: 0,
          typeArguments: null,
        },
        {
          name: "Target",
          type: 0,
          typeArguments: null,
        },
        {
          name: "EvmExecutor",
          type: 0,
          typeArguments: null,
        },
        {
          name: "StacksTarget",
          type: 0,
          typeArguments: null,
        },
        {
          name: "Invalid",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 6,
      type: "enum Identity",
      components: [
        {
          name: "Address",
          type: 14,
          typeArguments: null,
        },
        {
          name: "ContractId",
          type: 18,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 7,
      type: "enum InitializationError",
      components: [
        {
          name: "CannotReinitialized",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 8,
      type: "enum PythError",
      components: [
        {
          name: "FeesCanOnlyBePaidInTheBaseAsset",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianSetNotFound",
          type: 0,
          typeArguments: null,
        },
        {
          name: "IncorrectMessageType",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InsufficientFee",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidArgument",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidAttestationSize",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidDataSourcesLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidExponent",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceDataSource",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceAction",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceMessage",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceModule",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceTarget",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidHeaderSize",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidMagic",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidMajorVersion",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidMinorVersion",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidPayloadId",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidPayloadLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidPriceFeedDataLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidProof",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidUpdateData",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidUpdateDataLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidUpdateDataSource",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidUpgradeModule",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidWormholeAddressToSet",
          type: 0,
          typeArguments: null,
        },
        {
          name: "LengthOfPriceFeedIdsAndPublishTimesMustMatch",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NewGuardianSetIsEmpty",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NumberOfUpdatesIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "OldGovernanceMessage",
          type: 0,
          typeArguments: null,
        },
        {
          name: "OutdatedPrice",
          type: 0,
          typeArguments: null,
        },
        {
          name: "PriceFeedNotFound",
          type: 0,
          typeArguments: null,
        },
        {
          name: "PriceFeedNotFoundWithinRange",
          type: 0,
          typeArguments: null,
        },
        {
          name: "WormholeGovernanceActionNotFound",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 9,
      type: "enum State",
      components: [
        {
          name: "Uninitialized",
          type: 0,
          typeArguments: null,
        },
        {
          name: "Initialized",
          type: 6,
          typeArguments: null,
        },
        {
          name: "Revoked",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 10,
      type: "enum WormholeError",
      components: [
        {
          name: "ConsistencyLevelIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GovernanceActionAlreadyConsumed",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianIndexIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianSetHasExpired",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianSetKeyIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianSetKeysLengthNotEqual",
          type: 0,
          typeArguments: null,
        },
        {
          name: "GuardianSetNotFound",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceAction",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceChain",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGovernanceContract",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGuardianSet",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGuardianSetKeysLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGuardianSetUpgrade",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidGuardianSetUpgradeLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidModule",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidPayloadLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidSignatureLength",
          type: 0,
          typeArguments: null,
        },
        {
          name: "InvalidUpdateDataSource",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NewGuardianSetIsEmpty",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NewGuardianSetIndexIsInvalid",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NoQuorum",
          type: 0,
          typeArguments: null,
        },
        {
          name: "NotSignedByCurrentGuardianSet",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SignatureInvalid",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SignatureIndicesNotAscending",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SignatureVIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "SignersLengthIrretrievable",
          type: 0,
          typeArguments: null,
        },
        {
          name: "VMSignatureInvalid",
          type: 0,
          typeArguments: null,
        },
        {
          name: "VMVersionIncompatible",
          type: 0,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 11,
      type: "generic T",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 12,
      type: "raw untyped ptr",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 13,
      type: "str",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 14,
      type: "struct Address",
      components: [
        {
          name: "bits",
          type: 1,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 15,
      type: "struct AuthorizeGovernanceDataSourceTransferPayload",
      components: [
        {
          name: "claim_vaa",
          type: 16,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 16,
      type: "struct Bytes",
      components: [
        {
          name: "buf",
          type: 30,
          typeArguments: null,
        },
        {
          name: "len",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 17,
      type: "struct ConstructedEvent",
      components: [
        {
          name: "guardian_set_index",
          type: 39,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 18,
      type: "struct ContractId",
      components: [
        {
          name: "bits",
          type: 1,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 19,
      type: "struct DataSource",
      components: [
        {
          name: "chain_id",
          type: 38,
          typeArguments: null,
        },
        {
          name: "emitter_address",
          type: 1,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 20,
      type: "struct DataSourcesSetEvent",
      components: [
        {
          name: "old_data_sources",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 19,
              typeArguments: null,
            },
          ],
        },
        {
          name: "new_data_sources",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 19,
              typeArguments: null,
            },
          ],
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 21,
      type: "struct FeeSetEvent",
      components: [
        {
          name: "old_fee",
          type: 40,
          typeArguments: null,
        },
        {
          name: "new_fee",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 22,
      type: "struct GovernanceDataSourceSetEvent",
      components: [
        {
          name: "old_data_source",
          type: 19,
          typeArguments: null,
        },
        {
          name: "new_data_source",
          type: 19,
          typeArguments: null,
        },
        {
          name: "initial_sequence",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 23,
      type: "struct GovernanceInstruction",
      components: [
        {
          name: "magic",
          type: 39,
          typeArguments: null,
        },
        {
          name: "module",
          type: 5,
          typeArguments: null,
        },
        {
          name: "action",
          type: 4,
          typeArguments: null,
        },
        {
          name: "target_chain_id",
          type: 38,
          typeArguments: null,
        },
        {
          name: "payload",
          type: 16,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 24,
      type: "struct GuardianSet",
      components: [
        {
          name: "expiration_time",
          type: 40,
          typeArguments: null,
        },
        {
          name: "keys",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 1,
              typeArguments: null,
            },
          ],
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 25,
      type: "struct NewGuardianSetEvent",
      components: [
        {
          name: "governance_action_hash",
          type: 1,
          typeArguments: null,
        },
        {
          name: "new_guardian_set_index",
          type: 39,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 26,
      type: "struct OwnershipRenounced",
      components: [
        {
          name: "previous_owner",
          type: 6,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 27,
      type: "struct OwnershipSet",
      components: [
        {
          name: "new_owner",
          type: 6,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 28,
      type: "struct Price",
      components: [
        {
          name: "confidence",
          type: 40,
          typeArguments: null,
        },
        {
          name: "exponent",
          type: 39,
          typeArguments: null,
        },
        {
          name: "price",
          type: 40,
          typeArguments: null,
        },
        {
          name: "publish_time",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 29,
      type: "struct PriceFeed",
      components: [
        {
          name: "ema_price",
          type: 28,
          typeArguments: null,
        },
        {
          name: "id",
          type: 1,
          typeArguments: null,
        },
        {
          name: "price",
          type: 28,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 30,
      type: "struct RawBytes",
      components: [
        {
          name: "ptr",
          type: 12,
          typeArguments: null,
        },
        {
          name: "cap",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 31,
      type: "struct RawVec",
      components: [
        {
          name: "ptr",
          type: 12,
          typeArguments: null,
        },
        {
          name: "cap",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: [11],
    },
    {
      typeId: 32,
      type: "struct SetDataSourcesPayload",
      components: [
        {
          name: "data_sources",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 19,
              typeArguments: null,
            },
          ],
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 33,
      type: "struct SetFeePayload",
      components: [
        {
          name: "new_fee",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 34,
      type: "struct SetValidPeriodPayload",
      components: [
        {
          name: "new_valid_period",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 35,
      type: "struct ValidPeriodSetEvent",
      components: [
        {
          name: "old_valid_period",
          type: 40,
          typeArguments: null,
        },
        {
          name: "new_valid_period",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 36,
      type: "struct Vec",
      components: [
        {
          name: "buf",
          type: 31,
          typeArguments: [
            {
              name: "",
              type: 11,
              typeArguments: null,
            },
          ],
        },
        {
          name: "len",
          type: 40,
          typeArguments: null,
        },
      ],
      typeParameters: [11],
    },
    {
      typeId: 37,
      type: "struct WormholeVM",
      components: [
        {
          name: "version",
          type: 41,
          typeArguments: null,
        },
        {
          name: "guardian_set_index",
          type: 39,
          typeArguments: null,
        },
        {
          name: "governance_action_hash",
          type: 1,
          typeArguments: null,
        },
        {
          name: "timestamp",
          type: 39,
          typeArguments: null,
        },
        {
          name: "nonce",
          type: 39,
          typeArguments: null,
        },
        {
          name: "emitter_chain_id",
          type: 38,
          typeArguments: null,
        },
        {
          name: "emitter_address",
          type: 1,
          typeArguments: null,
        },
        {
          name: "sequence",
          type: 40,
          typeArguments: null,
        },
        {
          name: "consistency_level",
          type: 41,
          typeArguments: null,
        },
        {
          name: "payload",
          type: 16,
          typeArguments: null,
        },
      ],
      typeParameters: null,
    },
    {
      typeId: 38,
      type: "u16",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 39,
      type: "u32",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 40,
      type: "u64",
      components: null,
      typeParameters: null,
    },
    {
      typeId: 41,
      type: "u8",
      components: null,
      typeParameters: null,
    },
  ],
  functions: [
    {
      inputs: [],
      name: "owner",
      output: {
        name: "",
        type: 9,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "ema_price",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "time_period",
          type: 40,
          typeArguments: null,
        },
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "ema_price_no_older_than",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "ema_price_unsafe",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "max_publish_time",
          type: 40,
          typeArguments: null,
        },
        {
          name: "min_publish_time",
          type: 40,
          typeArguments: null,
        },
        {
          name: "target_price_feed_ids",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 1,
              typeArguments: null,
            },
          ],
        },
        {
          name: "update_data",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 16,
              typeArguments: null,
            },
          ],
        },
      ],
      name: "parse_price_feed_updates",
      output: {
        name: "",
        type: 36,
        typeArguments: [
          {
            name: "",
            type: 29,
            typeArguments: null,
          },
        ],
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
        {
          name: "payable",
          arguments: [],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "price",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "time_period",
          type: 40,
          typeArguments: null,
        },
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "price_no_older_than",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "price_unsafe",
      output: {
        name: "",
        type: 28,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "update_data",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 16,
              typeArguments: null,
            },
          ],
        },
      ],
      name: "update_fee",
      output: {
        name: "",
        type: 40,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "update_data",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 16,
              typeArguments: null,
            },
          ],
        },
      ],
      name: "update_price_feeds",
      output: {
        name: "",
        type: 0,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read", "write"],
        },
        {
          name: "payable",
          arguments: [],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_ids",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 1,
              typeArguments: null,
            },
          ],
        },
        {
          name: "publish_times",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 40,
              typeArguments: null,
            },
          ],
        },
        {
          name: "update_data",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 16,
              typeArguments: null,
            },
          ],
        },
      ],
      name: "update_price_feeds_if_necessary",
      output: {
        name: "",
        type: 0,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read", "write"],
        },
        {
          name: "payable",
          arguments: [],
        },
      ],
    },
    {
      inputs: [],
      name: "valid_time_period",
      output: {
        name: "",
        type: 40,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "data_sources",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 19,
              typeArguments: null,
            },
          ],
        },
        {
          name: "governance_data_source",
          type: 19,
          typeArguments: null,
        },
        {
          name: "wormhole_governance_data_source",
          type: 19,
          typeArguments: null,
        },
        {
          name: "single_update_fee",
          type: 40,
          typeArguments: null,
        },
        {
          name: "valid_time_period_seconds",
          type: 40,
          typeArguments: null,
        },
        {
          name: "wormhole_guardian_set_addresses",
          type: 36,
          typeArguments: [
            {
              name: "",
              type: 1,
              typeArguments: null,
            },
          ],
        },
        {
          name: "wormhole_guardian_set_index",
          type: 39,
          typeArguments: null,
        },
        {
          name: "chain_id",
          type: 38,
          typeArguments: null,
        },
      ],
      name: "constructor",
      output: {
        name: "",
        type: 0,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read", "write"],
        },
      ],
    },
    {
      inputs: [],
      name: "chain_id",
      output: {
        name: "",
        type: 38,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "data_source",
          type: 19,
          typeArguments: null,
        },
      ],
      name: "is_valid_data_source",
      output: {
        name: "",
        type: 2,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [],
      name: "last_executed_governance_sequence",
      output: {
        name: "",
        type: 40,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "latest_publish_time",
      output: {
        name: "",
        type: 40,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "price_feed_exists",
      output: {
        name: "",
        type: 2,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "price_feed_id",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "price_feed_unsafe",
      output: {
        name: "",
        type: 29,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [],
      name: "single_update_fee",
      output: {
        name: "",
        type: 40,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [],
      name: "valid_data_sources",
      output: {
        name: "",
        type: 36,
        typeArguments: [
          {
            name: "",
            type: 19,
            typeArguments: null,
          },
        ],
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [],
      name: "current_guardian_set_index",
      output: {
        name: "",
        type: 39,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [],
      name: "current_wormhole_provider",
      output: {
        name: "",
        type: 19,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "governance_action_hash",
          type: 1,
          typeArguments: null,
        },
      ],
      name: "governance_action_is_consumed",
      output: {
        name: "",
        type: 2,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "index",
          type: 39,
          typeArguments: null,
        },
      ],
      name: "guardian_set",
      output: {
        name: "",
        type: 24,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "encoded_vm",
          type: 16,
          typeArguments: null,
        },
      ],
      name: "submit_new_guardian_set",
      output: {
        name: "",
        type: 0,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read", "write"],
        },
      ],
    },
    {
      inputs: [
        {
          name: "encoded_vm",
          type: 16,
          typeArguments: null,
        },
      ],
      name: "execute_governance_instruction",
      output: {
        name: "",
        type: 0,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read", "write"],
        },
      ],
    },
    {
      inputs: [],
      name: "governance_data_source",
      output: {
        name: "",
        type: 19,
        typeArguments: null,
      },
      attributes: [
        {
          name: "storage",
          arguments: ["read"],
        },
      ],
    },
  ],
  loggedTypes: [
    {
      logId: "17263759643364419401",
      loggedType: {
        name: "",
        type: 8,
        typeArguments: [],
      },
    },
    {
      logId: "6097575393373596634",
      loggedType: {
        name: "",
        type: 10,
        typeArguments: [],
      },
    },
    {
      logId: "2161305517876418151",
      loggedType: {
        name: "",
        type: 7,
        typeArguments: [],
      },
    },
    {
      logId: "16280289466020123285",
      loggedType: {
        name: "",
        type: 27,
        typeArguments: [],
      },
    },
    {
      logId: "4571204900286667806",
      loggedType: {
        name: "",
        type: 3,
        typeArguments: [],
      },
    },
    {
      logId: "4883303303013154842",
      loggedType: {
        name: "",
        type: 26,
        typeArguments: [],
      },
    },
    {
      logId: "15458268789670052309",
      loggedType: {
        name: "",
        type: 17,
        typeArguments: [],
      },
    },
    {
      logId: "15522444483018429170",
      loggedType: {
        name: "",
        type: 25,
        typeArguments: [],
      },
    },
    {
      logId: "13658014858265200820",
      loggedType: {
        name: "",
        type: 37,
        typeArguments: [],
      },
    },
    {
      logId: "13826841070488844162",
      loggedType: {
        name: "",
        type: 23,
        typeArguments: [],
      },
    },
    {
      logId: "10098701174489624218",
      loggedType: {
        name: "",
        type: 13,
        typeArguments: null,
      },
    },
    {
      logId: "1142064842477676760",
      loggedType: {
        name: "",
        type: 15,
        typeArguments: [],
      },
    },
    {
      logId: "6349313752173641777",
      loggedType: {
        name: "",
        type: 22,
        typeArguments: [],
      },
    },
    {
      logId: "9922871334772410980",
      loggedType: {
        name: "",
        type: 32,
        typeArguments: [],
      },
    },
    {
      logId: "10192771768357409321",
      loggedType: {
        name: "",
        type: 20,
        typeArguments: [],
      },
    },
    {
      logId: "12784292968044359727",
      loggedType: {
        name: "",
        type: 33,
        typeArguments: [],
      },
    },
    {
      logId: "2489113073291466941",
      loggedType: {
        name: "",
        type: 21,
        typeArguments: [],
      },
    },
    {
      logId: "6138708451323859849",
      loggedType: {
        name: "",
        type: 34,
        typeArguments: [],
      },
    },
    {
      logId: "18185755007736345251",
      loggedType: {
        name: "",
        type: 35,
        typeArguments: [],
      },
    },
  ],
  messagesTypes: [],
  configurables: [
    {
      name: "DEPLOYER",
      configurableType: {
        name: "",
        type: 6,
        typeArguments: [],
      },
      offset: 129616,
    },
  ],
};

const _storageSlots: StorageSlot[] = [
  {
    key: "6294951dcb0a9111a517be5cf4785670ff4e166fb5ab9c33b17e6881b48e964f",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "71217a24656901c411894bb65eb78a828dafa5a6844488ef5024eb5ac0cff79c",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "71217a24656901c411894bb65eb78a828dafa5a6844488ef5024eb5ac0cff79d",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "7f91d1a929dce734e7f930bbb279ccfccdb5474227502ea8845815c74bd930a7",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "8a89a0cce819e0426e565819a9a98711329087da5a802fb16edd223c47fa44ef",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "94b2b70d20da552763c7614981b2a4d984380d7ed4e54c01b28c914e79e44bd5",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "94b2b70d20da552763c7614981b2a4d984380d7ed4e54c01b28c914e79e44bd6",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "a9203bbb8366ca9d708705dce980acbb54d44fb753370ffe4c7d351b46b2abbc",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "b48b753af346966d0d169c0b2e3234611f65d5cfdb57c7b6e7cd6ca93707bee0",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "c7e08cdde76020f08f4ce5c3257422ae67f9676992689b64b85f35aa58752d9e",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "c7e08cdde76020f08f4ce5c3257422ae67f9676992689b64b85f35aa58752d9f",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    key: "d02e07f5a716bd3b6670aaf9a73352164e6b946c24db14f72005b7029e67d96a",
    value: "0000000000000000000000000000000000000000000000000000000000000000",
  },
];
export const PythContractAbi__factory = {
  abi: _abi,

  storageSlots: _storageSlots,

  createInterface(): PythContractAbiInterface {
    return new Interface(_abi) as unknown as PythContractAbiInterface;
  },

  connect(
    id: string | AbstractAddress,
    accountOrProvider: Account | Provider
  ): PythContractAbi {
    return new Contract(
      id,
      _abi,
      accountOrProvider
    ) as unknown as PythContractAbi;
  },

  async deployContract(
    bytecode: BytesLike,
    wallet: Account,
    options: DeployContractOptions = {}
  ): Promise<PythContractAbi> {
    const factory = new ContractFactory(bytecode, _abi, wallet);

    const contract = await factory.deployContract({
      storageSlots: _storageSlots,
      ...options,
    });

    return contract as unknown as PythContractAbi;
  },
};
