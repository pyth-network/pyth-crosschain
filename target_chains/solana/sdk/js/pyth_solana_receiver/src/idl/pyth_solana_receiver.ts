export type PythSolanaReceiver = {
  version: "0.2.1";
  name: "pyth_solana_receiver";
  instructions: [
    {
      name: "initialize";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "initialConfig";
          type: {
            defined: "Config";
          };
        },
      ];
    },
    {
      name: "requestGovernanceAuthorityTransfer";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "targetGovernanceAuthority";
          type: "publicKey";
        },
      ];
    },
    {
      name: "cancelGovernanceAuthorityTransfer";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "acceptGovernanceAuthorityTransfer";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "setDataSources";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "validDataSources";
          type: {
            vec: {
              defined: "DataSource";
            };
          };
        },
      ];
    },
    {
      name: "setFee";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "singleUpdateFeeInLamports";
          type: "u64";
        },
      ];
    },
    {
      name: "setWormholeAddress";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "wormhole";
          type: "publicKey";
        },
      ];
    },
    {
      name: "setMinimumSignatures";
      accounts: [
        {
          name: "payer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "minimumSignatures";
          type: "u8";
        },
      ];
    },
    {
      name: "postUpdateAtomic";
      docs: [
        "Post a price update using a VAA and a MerklePriceUpdate.",
        "This function allows you to post a price update in a single transaction.",
        "Compared to `post_update`, it only checks whatever signatures are present in the provided VAA and doesn't fail if the number of signatures is lower than the Wormhole quorum of two thirds of the guardians.",
        "The number of signatures that were in the VAA is stored in the `VerificationLevel` of the `PriceUpdateV2` account.",
        "",
        "We recommend using `post_update_atomic` with 5 signatures. This is close to the maximum signatures you can verify in one transaction without exceeding the transaction size limit.",
        "",
        "# Warning",
        "",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update.",
      ];
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "guardianSet";
          isMut: false;
          isSigner: false;
          docs: [
            "Instead we do the same steps in deserialize_guardian_set_checked.",
          ];
        },
        {
          name: "config";
          isMut: false;
          isSigner: false;
        },
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "priceUpdateAccount";
          isMut: true;
          isSigner: true;
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "writeAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "PostUpdateAtomicParams";
          };
        },
      ];
    },
    {
      name: "postUpdate";
      docs: [
        "Post a price update using an encoded_vaa account and a MerklePriceUpdate calldata.",
        "This should be called after the client has already verified the Vaa via the Wormhole contract.",
        "Check out target_chains/solana/cli/src/main.rs for an example of how to do this.",
      ];
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "encodedVaa";
          isMut: false;
          isSigner: false;
        },
        {
          name: "config";
          isMut: false;
          isSigner: false;
        },
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "priceUpdateAccount";
          isMut: true;
          isSigner: true;
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "writeAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "PostUpdateParams";
          };
        },
      ];
    },
    {
      name: "postTwapUpdate";
      docs: [
        "Post a TWAP (time weighted average price) update for a given time window.",
        "This should be called after the client has already verified the VAAs via the Wormhole contract.",
        "Check out target_chains/solana/cli/src/main.rs for an example of how to do this.",
      ];
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "startEncodedVaa";
          isMut: false;
          isSigner: false;
        },
        {
          name: "endEncodedVaa";
          isMut: false;
          isSigner: false;
        },
        {
          name: "config";
          isMut: false;
          isSigner: false;
        },
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "twapUpdateAccount";
          isMut: true;
          isSigner: true;
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "writeAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "PostTwapUpdateParams";
          };
        },
      ];
    },
    {
      name: "reclaimRent";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "priceUpdateAccount";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "reclaimTwapRent";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "twapUpdateAccount";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "Config";
      type: {
        kind: "struct";
        fields: [
          {
            name: "governanceAuthority";
            type: "publicKey";
          },
          {
            name: "targetGovernanceAuthority";
            type: {
              option: "publicKey";
            };
          },
          {
            name: "wormhole";
            type: "publicKey";
          },
          {
            name: "validDataSources";
            type: {
              vec: {
                defined: "DataSource";
              };
            };
          },
          {
            name: "singleUpdateFeeInLamports";
            type: "u64";
          },
          {
            name: "minimumSignatures";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "priceUpdateV2";
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "publicKey";
          },
          {
            name: "verificationLevel";
            type: {
              defined: "VerificationLevel";
            };
          },
          {
            name: "priceMessage";
            type: {
              defined: "PriceFeedMessage";
            };
          },
          {
            name: "postedSlot";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "twapUpdate";
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "publicKey";
          },
          {
            name: "twap";
            type: {
              defined: "TwapPrice";
            };
          },
        ];
      };
    },
  ];
  types: [
    {
      name: "PriceFeedMessage";
      type: {
        kind: "struct";
        fields: [
          {
            name: "feedId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          },
          {
            name: "publishTime";
            type: "i64";
          },
          {
            name: "prevPublishTime";
            type: "i64";
          },
          {
            name: "emaPrice";
            type: "i64";
          },
          {
            name: "emaConf";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "TwapPrice";
      docs: [
        "The time weighted average price & conf for a feed over the window [start_time, end_time].",
        "This type is used to persist the calculated TWAP in TwapUpdate accounts on Solana.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "feedId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "startTime";
            type: "i64";
          },
          {
            name: "endTime";
            type: "i64";
          },
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          },
          {
            name: "downSlotsRatio";
            docs: [
              "Ratio out of 1_000_000, where a value of 1_000_000 represents",
              "all slots were missed and 0 represents no slots were missed.",
            ];
            type: "u32";
          },
        ];
      };
    },
    {
      name: "MerklePriceUpdate";
      type: {
        kind: "struct";
        fields: [
          {
            name: "message";
            type: "bytes";
          },
          {
            name: "proof";
            type: {
              vec: {
                array: ["u8", 20];
              };
            };
          },
        ];
      };
    },
    {
      name: "DataSource";
      type: {
        kind: "struct";
        fields: [
          {
            name: "chain";
            type: "u16";
          },
          {
            name: "emitter";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "PostUpdateAtomicParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "vaa";
            type: "bytes";
          },
          {
            name: "merklePriceUpdate";
            type: {
              defined: "MerklePriceUpdate";
            };
          },
          {
            name: "treasuryId";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "PostUpdateParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "merklePriceUpdate";
            type: {
              defined: "MerklePriceUpdate";
            };
          },
          {
            name: "treasuryId";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "PostTwapUpdateParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "startMerklePriceUpdate";
            type: {
              defined: "MerklePriceUpdate";
            };
          },
          {
            name: "endMerklePriceUpdate";
            type: {
              defined: "MerklePriceUpdate";
            };
          },
          {
            name: "treasuryId";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "VerificationLevel";
      docs: [
        "* This enum represents how many guardian signatures were checked for a Pythnet price update\n * If full, guardian quorum has been attained\n * If partial, at least config.minimum signatures have been verified, but in the case config.minimum_signatures changes in the future we also include the number of signatures that were checked",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Partial";
            fields: [
              {
                name: "numSignatures";
                type: "u8";
              },
            ];
          },
          {
            name: "Full";
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidWormholeMessage";
      msg: "Received an invalid wormhole message";
    },
    {
      code: 6001;
      name: "DeserializeMessageFailed";
      msg: "An error occurred when deserializing the message";
    },
    {
      code: 6002;
      name: "InvalidPriceUpdate";
      msg: "Received an invalid price update";
    },
    {
      code: 6003;
      name: "UnsupportedMessageType";
      msg: "This type of message is not supported currently";
    },
    {
      code: 6004;
      name: "InvalidDataSource";
      msg: "The tuple emitter chain, emitter doesn't match one of the valid data sources.";
    },
    {
      code: 6005;
      name: "InsufficientFunds";
      msg: "Funds are insufficient to pay the receiving fee";
    },
    {
      code: 6006;
      name: "FeedIdMismatch";
      msg: "Cannot calculate TWAP, end slot must be greater than start slot";
    },
    {
      code: 6007;
      name: "ExponentMismatch";
      msg: "The start and end messages must have the same feed ID";
    },
    {
      code: 6008;
      name: "InvalidTwapSlots";
      msg: "The start and end messages must have the same exponent";
    },
    {
      code: 6009;
      name: "InvalidTwapStartMessage";
      msg: "Start message is not the first update for its timestamp";
    },
    {
      code: 6010;
      name: "InvalidTwapEndMessage";
      msg: "End message is not the first update for its timestamp";
    },
    {
      code: 6011;
      name: "TwapCalculationOverflow";
      msg: "Overflow in TWAP calculation";
    },
    {
      code: 6012;
      name: "WrongWriteAuthority";
      msg: "This signer can't write to price update account";
    },
    {
      code: 6013;
      name: "WrongVaaOwner";
      msg: "The posted VAA account has the wrong owner.";
    },
    {
      code: 6014;
      name: "DeserializeVaaFailed";
      msg: "An error occurred when deserializing the VAA.";
    },
    {
      code: 6015;
      name: "InsufficientGuardianSignatures";
      msg: "The number of guardian signatures is below the minimum";
    },
    {
      code: 6016;
      name: "InvalidVaaVersion";
      msg: "Invalid VAA version";
    },
    {
      code: 6017;
      name: "GuardianSetMismatch";
      msg: "Guardian set version in the VAA doesn't match the guardian set passed";
    },
    {
      code: 6018;
      name: "InvalidGuardianOrder";
      msg: "Guardian signature indices must be increasing";
    },
    {
      code: 6019;
      name: "InvalidGuardianIndex";
      msg: "Guardian index exceeds the number of guardians in the set";
    },
    {
      code: 6020;
      name: "InvalidSignature";
      msg: "A VAA signature is invalid";
    },
    {
      code: 6021;
      name: "InvalidGuardianKeyRecovery";
      msg: "The recovered guardian public key doesn't match the guardian set";
    },
    {
      code: 6022;
      name: "WrongGuardianSetOwner";
      msg: "The guardian set account is owned by the wrong program";
    },
    {
      code: 6023;
      name: "InvalidGuardianSetPda";
      msg: "The Guardian Set account doesn't match the PDA derivation";
    },
    {
      code: 6024;
      name: "GuardianSetExpired";
      msg: "The Guardian Set is expired";
    },
    {
      code: 6025;
      name: "GovernanceAuthorityMismatch";
      msg: "The signer is not authorized to perform this governance action";
    },
    {
      code: 6026;
      name: "TargetGovernanceAuthorityMismatch";
      msg: "The signer is not authorized to accept the governance authority";
    },
    {
      code: 6027;
      name: "NonexistentGovernanceAuthorityTransferRequest";
      msg: "The governance authority needs to request a transfer first";
    },
    {
      code: 6028;
      name: "ZeroMinimumSignatures";
      msg: "The minimum number of signatures should be at least 1";
    },
  ];
};

export const IDL: PythSolanaReceiver = {
  version: "0.2.1",
  name: "pyth_solana_receiver",
  instructions: [
    {
      name: "initialize",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "initialConfig",
          type: {
            defined: "Config",
          },
        },
      ],
    },
    {
      name: "requestGovernanceAuthorityTransfer",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "targetGovernanceAuthority",
          type: "publicKey",
        },
      ],
    },
    {
      name: "cancelGovernanceAuthorityTransfer",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "acceptGovernanceAuthorityTransfer",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setDataSources",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "validDataSources",
          type: {
            vec: {
              defined: "DataSource",
            },
          },
        },
      ],
    },
    {
      name: "setFee",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "singleUpdateFeeInLamports",
          type: "u64",
        },
      ],
    },
    {
      name: "setWormholeAddress",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "wormhole",
          type: "publicKey",
        },
      ],
    },
    {
      name: "setMinimumSignatures",
      accounts: [
        {
          name: "payer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "minimumSignatures",
          type: "u8",
        },
      ],
    },
    {
      name: "postUpdateAtomic",
      docs: [
        "Post a price update using a VAA and a MerklePriceUpdate.",
        "This function allows you to post a price update in a single transaction.",
        "Compared to `post_update`, it only checks whatever signatures are present in the provided VAA and doesn't fail if the number of signatures is lower than the Wormhole quorum of two thirds of the guardians.",
        "The number of signatures that were in the VAA is stored in the `VerificationLevel` of the `PriceUpdateV2` account.",
        "",
        "We recommend using `post_update_atomic` with 5 signatures. This is close to the maximum signatures you can verify in one transaction without exceeding the transaction size limit.",
        "",
        "# Warning",
        "",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update.",
      ],
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "guardianSet",
          isMut: false,
          isSigner: false,
          docs: [
            "Instead we do the same steps in deserialize_guardian_set_checked.",
          ],
        },
        {
          name: "config",
          isMut: false,
          isSigner: false,
        },
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "priceUpdateAccount",
          isMut: true,
          isSigner: true,
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "writeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "PostUpdateAtomicParams",
          },
        },
      ],
    },
    {
      name: "postUpdate",
      docs: [
        "Post a price update using an encoded_vaa account and a MerklePriceUpdate calldata.",
        "This should be called after the client has already verified the Vaa via the Wormhole contract.",
        "Check out target_chains/solana/cli/src/main.rs for an example of how to do this.",
      ],
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "encodedVaa",
          isMut: false,
          isSigner: false,
        },
        {
          name: "config",
          isMut: false,
          isSigner: false,
        },
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "priceUpdateAccount",
          isMut: true,
          isSigner: true,
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "writeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "PostUpdateParams",
          },
        },
      ],
    },
    {
      name: "postTwapUpdate",
      docs: [
        "Post a TWAP (time weighted average price) update for a given time window.",
        "This should be called after the client has already verified the VAAs via the Wormhole contract.",
        "Check out target_chains/solana/cli/src/main.rs for an example of how to do this.",
      ],
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "startEncodedVaa",
          isMut: false,
          isSigner: false,
        },
        {
          name: "endEncodedVaa",
          isMut: false,
          isSigner: false,
        },
        {
          name: "config",
          isMut: false,
          isSigner: false,
        },
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "twapUpdateAccount",
          isMut: true,
          isSigner: true,
          docs: [
            "The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.",
            "Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized",
          ],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "writeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "PostTwapUpdateParams",
          },
        },
      ],
    },
    {
      name: "reclaimRent",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "priceUpdateAccount",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "reclaimTwapRent",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "twapUpdateAccount",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Config",
      type: {
        kind: "struct",
        fields: [
          {
            name: "governanceAuthority",
            type: "publicKey",
          },
          {
            name: "targetGovernanceAuthority",
            type: {
              option: "publicKey",
            },
          },
          {
            name: "wormhole",
            type: "publicKey",
          },
          {
            name: "validDataSources",
            type: {
              vec: {
                defined: "DataSource",
              },
            },
          },
          {
            name: "singleUpdateFeeInLamports",
            type: "u64",
          },
          {
            name: "minimumSignatures",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "priceUpdateV2",
      type: {
        kind: "struct",
        fields: [
          {
            name: "writeAuthority",
            type: "publicKey",
          },
          {
            name: "verificationLevel",
            type: {
              defined: "VerificationLevel",
            },
          },
          {
            name: "priceMessage",
            type: {
              defined: "PriceFeedMessage",
            },
          },
          {
            name: "postedSlot",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "twapUpdate",
      type: {
        kind: "struct",
        fields: [
          {
            name: "writeAuthority",
            type: "publicKey",
          },
          {
            name: "twap",
            type: {
              defined: "TwapPrice",
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "PriceFeedMessage",
      type: {
        kind: "struct",
        fields: [
          {
            name: "feedId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "price",
            type: "i64",
          },
          {
            name: "conf",
            type: "u64",
          },
          {
            name: "exponent",
            type: "i32",
          },
          {
            name: "publishTime",
            type: "i64",
          },
          {
            name: "prevPublishTime",
            type: "i64",
          },
          {
            name: "emaPrice",
            type: "i64",
          },
          {
            name: "emaConf",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "TwapPrice",
      docs: [
        "The time weighted average price & conf for a feed over the window [start_time, end_time].",
        "This type is used to persist the calculated TWAP in TwapUpdate accounts on Solana.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "feedId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "startTime",
            type: "i64",
          },
          {
            name: "endTime",
            type: "i64",
          },
          {
            name: "price",
            type: "i64",
          },
          {
            name: "conf",
            type: "u64",
          },
          {
            name: "exponent",
            type: "i32",
          },
          {
            name: "downSlotsRatio",
            docs: [
              "Ratio out of 1_000_000, where a value of 1_000_000 represents",
              "all slots were missed and 0 represents no slots were missed.",
            ],
            type: "u32",
          },
        ],
      },
    },
    {
      name: "MerklePriceUpdate",
      type: {
        kind: "struct",
        fields: [
          {
            name: "message",
            type: "bytes",
          },
          {
            name: "proof",
            type: {
              vec: {
                array: ["u8", 20],
              },
            },
          },
        ],
      },
    },
    {
      name: "DataSource",
      type: {
        kind: "struct",
        fields: [
          {
            name: "chain",
            type: "u16",
          },
          {
            name: "emitter",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "PostUpdateAtomicParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "vaa",
            type: "bytes",
          },
          {
            name: "merklePriceUpdate",
            type: {
              defined: "MerklePriceUpdate",
            },
          },
          {
            name: "treasuryId",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "PostUpdateParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "merklePriceUpdate",
            type: {
              defined: "MerklePriceUpdate",
            },
          },
          {
            name: "treasuryId",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "PostTwapUpdateParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "startMerklePriceUpdate",
            type: {
              defined: "MerklePriceUpdate",
            },
          },
          {
            name: "endMerklePriceUpdate",
            type: {
              defined: "MerklePriceUpdate",
            },
          },
          {
            name: "treasuryId",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "VerificationLevel",
      docs: [
        "* This enum represents how many guardian signatures were checked for a Pythnet price update\n * If full, guardian quorum has been attained\n * If partial, at least config.minimum signatures have been verified, but in the case config.minimum_signatures changes in the future we also include the number of signatures that were checked",
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Partial",
            fields: [
              {
                name: "numSignatures",
                type: "u8",
              },
            ],
          },
          {
            name: "Full",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidWormholeMessage",
      msg: "Received an invalid wormhole message",
    },
    {
      code: 6001,
      name: "DeserializeMessageFailed",
      msg: "An error occurred when deserializing the message",
    },
    {
      code: 6002,
      name: "InvalidPriceUpdate",
      msg: "Received an invalid price update",
    },
    {
      code: 6003,
      name: "UnsupportedMessageType",
      msg: "This type of message is not supported currently",
    },
    {
      code: 6004,
      name: "InvalidDataSource",
      msg: "The tuple emitter chain, emitter doesn't match one of the valid data sources.",
    },
    {
      code: 6005,
      name: "InsufficientFunds",
      msg: "Funds are insufficient to pay the receiving fee",
    },
    {
      code: 6006,
      name: "FeedIdMismatch",
      msg: "Cannot calculate TWAP, end slot must be greater than start slot",
    },
    {
      code: 6007,
      name: "ExponentMismatch",
      msg: "The start and end messages must have the same feed ID",
    },
    {
      code: 6008,
      name: "InvalidTwapSlots",
      msg: "The start and end messages must have the same exponent",
    },
    {
      code: 6009,
      name: "InvalidTwapStartMessage",
      msg: "Start message is not the first update for its timestamp",
    },
    {
      code: 6010,
      name: "InvalidTwapEndMessage",
      msg: "End message is not the first update for its timestamp",
    },
    {
      code: 6011,
      name: "TwapCalculationOverflow",
      msg: "Overflow in TWAP calculation",
    },
    {
      code: 6012,
      name: "WrongWriteAuthority",
      msg: "This signer can't write to price update account",
    },
    {
      code: 6013,
      name: "WrongVaaOwner",
      msg: "The posted VAA account has the wrong owner.",
    },
    {
      code: 6014,
      name: "DeserializeVaaFailed",
      msg: "An error occurred when deserializing the VAA.",
    },
    {
      code: 6015,
      name: "InsufficientGuardianSignatures",
      msg: "The number of guardian signatures is below the minimum",
    },
    {
      code: 6016,
      name: "InvalidVaaVersion",
      msg: "Invalid VAA version",
    },
    {
      code: 6017,
      name: "GuardianSetMismatch",
      msg: "Guardian set version in the VAA doesn't match the guardian set passed",
    },
    {
      code: 6018,
      name: "InvalidGuardianOrder",
      msg: "Guardian signature indices must be increasing",
    },
    {
      code: 6019,
      name: "InvalidGuardianIndex",
      msg: "Guardian index exceeds the number of guardians in the set",
    },
    {
      code: 6020,
      name: "InvalidSignature",
      msg: "A VAA signature is invalid",
    },
    {
      code: 6021,
      name: "InvalidGuardianKeyRecovery",
      msg: "The recovered guardian public key doesn't match the guardian set",
    },
    {
      code: 6022,
      name: "WrongGuardianSetOwner",
      msg: "The guardian set account is owned by the wrong program",
    },
    {
      code: 6023,
      name: "InvalidGuardianSetPda",
      msg: "The Guardian Set account doesn't match the PDA derivation",
    },
    {
      code: 6024,
      name: "GuardianSetExpired",
      msg: "The Guardian Set is expired",
    },
    {
      code: 6025,
      name: "GovernanceAuthorityMismatch",
      msg: "The signer is not authorized to perform this governance action",
    },
    {
      code: 6026,
      name: "TargetGovernanceAuthorityMismatch",
      msg: "The signer is not authorized to accept the governance authority",
    },
    {
      code: 6027,
      name: "NonexistentGovernanceAuthorityTransferRequest",
      msg: "The governance authority needs to request a transfer first",
    },
    {
      code: 6028,
      name: "ZeroMinimumSignatures",
      msg: "The minimum number of signatures should be at least 1",
    },
  ],
};
