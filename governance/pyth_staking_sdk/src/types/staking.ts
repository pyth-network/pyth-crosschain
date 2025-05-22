/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/staking.json`.
 */
export type Staking = {
  address: "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
  metadata: {
    name: "staking";
    version: "2.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "acceptSplit";
      docs: [
        "* A split request can only be accepted by the `pda_authority` from\n     * the config account. If accepted, `amount` tokens are transferred to a new stake account\n     * owned by the `recipient` and the split request is reset (by setting `amount` to 0).\n     * The recipient of a transfer can't vote during the epoch of the transfer.\n     *\n     * The `pda_authority` must explicitly approve both the amount of tokens and recipient, and\n     * these parameters must match the request (in the `split_request` account).",
      ];
      discriminator: [177, 172, 17, 93, 193, 86, 54, 222];
      accounts: [
        {
          name: "pdaAuthority";
          writable: true;
          signer: true;
          relations: ["config"];
        },
        {
          name: "sourceStakeAccountPositions";
          writable: true;
        },
        {
          name: "sourceStakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "sourceStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "sourceStakeAccountSplitRequest";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  112,
                  108,
                  105,
                  116,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: "account";
                path: "sourceStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "sourceStakeAccountCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "sourceStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "sourceCustodyAuthority";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104, 111, 114, 105, 116, 121];
              },
              {
                kind: "account";
                path: "sourceStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "newStakeAccountPositions";
          writable: true;
        },
        {
          name: "newStakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "newStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "newStakeAccountCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "newStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "newCustodyAuthority";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104, 111, 114, 105, 116, 121];
              },
              {
                kind: "account";
                path: "newStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "pythTokenMint";
          relations: ["config"];
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "recipient";
          type: "pubkey";
        },
      ];
    },
    {
      name: "advanceClock";
      discriminator: [52, 57, 147, 111, 56, 227, 33, 127];
      accounts: [
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "seconds";
          type: "i64";
        },
      ];
    },
    {
      name: "closePosition";
      discriminator: [123, 134, 81, 0, 49, 68, 98, 98];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "targetAccount";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 114, 103, 101, 116];
              },
              {
                kind: "const";
                value: [118, 111, 116, 105, 110, 103];
              },
            ];
          };
        },
        {
          name: "poolAuthority";
          signer: true;
          optional: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "targetWithParameters";
          type: {
            defined: {
              name: "targetWithParameters";
            };
          };
        },
      ];
    },
    {
      name: "createPosition";
      docs: [
        "Creates a position",
        "Looks for the first available place in the array, fails if array is full",
        "Computes risk and fails if new positions exceed risk limit",
      ];
      discriminator: [48, 215, 197, 153, 96, 203, 180, 133];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "targetAccount";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 114, 103, 101, 116];
              },
              {
                kind: "const";
                value: [118, 111, 116, 105, 110, 103];
              },
            ];
          };
        },
        {
          name: "poolAuthority";
          signer: true;
          optional: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "targetWithParameters";
          type: {
            defined: {
              name: "targetWithParameters";
            };
          };
        },
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "createStakeAccount";
      docs: [
        "Trustless instruction that creates a stake account for a user",
        "The main account i.e. the position accounts needs to be initialized outside of the program",
        "otherwise we run into stack limits",
      ];
      discriminator: [105, 24, 131, 19, 201, 250, 157, 73];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "custodyAuthority";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104, 111, 114, 105, 116, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "pythTokenMint";
          relations: ["config"];
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "owner";
          type: "pubkey";
        },
        {
          name: "lock";
          type: {
            defined: {
              name: "vestingSchedule";
            };
          };
        },
      ];
    },
    {
      name: "createTarget";
      discriminator: [76, 144, 128, 239, 121, 210, 123, 39];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "targetAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 114, 103, 101, 116];
              },
              {
                kind: "const";
                value: [118, 111, 116, 105, 110, 103];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "createVoterRecord";
      discriminator: [3, 12, 113, 222, 177, 4, 152, 165];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "stakeAccountPositions";
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "voterRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  111,
                  116,
                  101,
                  114,
                  95,
                  119,
                  101,
                  105,
                  103,
                  104,
                  116,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "exportPositionType";
      discriminator: [219, 172, 149, 212, 103, 230, 164, 179];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "configAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "position";
          type: {
            defined: {
              name: "position";
            };
          };
        },
      ];
    },
    {
      name: "initConfig";
      discriminator: [23, 235, 115, 232, 168, 96, 1, 231];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "configAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "globalConfig";
          type: {
            defined: {
              name: "globalConfig";
            };
          };
        },
      ];
    },
    {
      name: "joinDaoLlc";
      docs: [
        "* Accept to join the DAO LLC\n     * This must happen before create_position or update_voter_weight\n     * The user signs a hash of the agreement and the program checks that the hash matches the\n     * agreement",
      ];
      discriminator: [79, 241, 203, 177, 232, 143, 124, 14];
      accounts: [
        {
          name: "owner";
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "agreementHash";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "mergeTargetPositions";
      discriminator: [21, 136, 57, 2, 204, 219, 242, 141];
      accounts: [
        {
          name: "owner";
          docs: [
            "CHECK : This AccountInfo is safe because it's checked against stake_account_metadata",
          ];
          writable: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "poolAuthority";
          signer: true;
          optional: true;
        },
      ];
      args: [
        {
          name: "targetWithParameters";
          type: {
            defined: {
              name: "targetWithParameters";
            };
          };
        },
      ];
    },
    {
      name: "recoverAccount";
      docs: [
        "Recovers a user's `stake account` ownership by transferring ownership\n     * from a token account to the `owner` of that token account.\n     *\n     * This functionality addresses the scenario where a user mistakenly\n     * created a stake account using their token account address as the owner.",
      ];
      discriminator: [240, 223, 246, 118, 26, 121, 34, 128];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "owner";
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "voterRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  111,
                  116,
                  101,
                  114,
                  95,
                  119,
                  101,
                  105,
                  103,
                  104,
                  116,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "requestSplit";
      docs: [
        "* Any user of the staking program can request to split their account and\n     * give a part of it to another user.\n     * This is mostly useful to transfer unvested tokens. Each user can only have one active\n     * request at a time.\n     * In the first step, the user requests a split by specifying the `amount` of tokens\n     * they want to give to the other user and the `recipient`'s pubkey.",
      ];
      discriminator: [133, 146, 228, 165, 251, 207, 146, 23];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
        },
        {
          name: "stakeAccountMetadata";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountSplitRequest";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  112,
                  108,
                  105,
                  116,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "recipient";
          type: "pubkey";
        },
      ];
    },
    {
      name: "slashAccount";
      discriminator: [185, 97, 8, 208, 118, 205, 166, 2];
      accounts: [
        {
          name: "poolAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "publisher";
          docs: [
            "CHECK : This AccountInfo is just used to construct the target that will get slashed",
          ];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "governanceTargetAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 114, 103, 101, 116];
              },
              {
                kind: "const";
                value: [118, 111, 116, 105, 110, 103];
              },
            ];
          };
        },
        {
          name: "destination";
          writable: true;
        },
        {
          name: "custodyAuthority";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104, 111, 114, 105, 116, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "slashRatio";
          type: "u64";
        },
      ];
    },
    {
      name: "transferAccount";
      docs: [
        "Transfers a user's stake account to a new owner provided by the `governance_authority`.\n     *\n     * This functionality addresses the scenario where a user doesn't have access to their owner\n     * key. Only accounts without any staked tokens can be transferred.",
      ];
      discriminator: [219, 120, 55, 105, 3, 139, 205, 6];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "newOwner";
          docs: [
            "CHECK : A new arbitrary owner provided by the governance_authority",
          ];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "voterRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  111,
                  116,
                  101,
                  114,
                  95,
                  119,
                  101,
                  105,
                  103,
                  104,
                  116,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: "updateAgreementHash";
      discriminator: [86, 232, 181, 137, 158, 110, 129, 238];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "agreementHash";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
    {
      name: "updateGovernanceAuthority";
      discriminator: [11, 185, 227, 55, 39, 32, 168, 14];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "newAuthority";
          type: "pubkey";
        },
      ];
    },
    {
      name: "updateMaxVoterWeight";
      discriminator: [248, 36, 229, 234, 11, 132, 145, 20];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "maxVoterRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 97, 120, 95, 118, 111, 116, 101, 114];
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "updatePdaAuthority";
      discriminator: [178, 112, 199, 196, 59, 40, 140, 61];
      accounts: [
        {
          name: "pdaAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "newAuthority";
          type: "pubkey";
        },
      ];
    },
    {
      name: "updatePoolAuthority";
      discriminator: [160, 162, 113, 9, 99, 187, 23, 239];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "poolAuthority";
          type: "pubkey";
        },
      ];
    },
    {
      name: "updateTokenListTime";
      discriminator: [38, 217, 99, 222, 253, 253, 31, 83];
      accounts: [
        {
          name: "governanceAuthority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "tokenListTime";
          type: {
            option: "i64";
          };
        },
      ];
    },
    {
      name: "updateVoterWeight";
      discriminator: [92, 35, 133, 94, 230, 70, 14, 157];
      accounts: [
        {
          name: "owner";
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "stakeAccountPositions";
        },
        {
          name: "stakeAccountMetadata";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "voterRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  111,
                  116,
                  101,
                  114,
                  95,
                  119,
                  101,
                  105,
                  103,
                  104,
                  116,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "governanceTarget";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 97, 114, 103, 101, 116];
              },
              {
                kind: "const";
                value: [118, 111, 116, 105, 110, 103];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "action";
          type: {
            defined: {
              name: "voterWeightAction";
            };
          };
        },
      ];
    },
    {
      name: "withdrawStake";
      discriminator: [153, 8, 22, 138, 105, 176, 87, 66];
      accounts: [
        {
          name: "owner";
          signer: true;
          relations: ["stakeAccountMetadata"];
        },
        {
          name: "destination";
          writable: true;
        },
        {
          name: "stakeAccountPositions";
        },
        {
          name: "stakeAccountMetadata";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "stakeAccountCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "custodyAuthority";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 117, 116, 104, 111, 114, 105, 116, 121];
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "globalConfig";
      discriminator: [149, 8, 156, 202, 160, 252, 176, 217];
    },
    {
      name: "maxVoterWeightRecord";
      discriminator: [157, 95, 242, 151, 16, 98, 26, 118];
    },
    {
      name: "positionData";
      discriminator: [85, 195, 241, 79, 124, 192, 79, 11];
    },
    {
      name: "splitRequest";
      discriminator: [80, 85, 187, 143, 62, 147, 234, 248];
    },
    {
      name: "stakeAccountMetadataV2";
      discriminator: [192, 51, 203, 19, 76, 177, 136, 97];
    },
    {
      name: "targetMetadata";
      discriminator: [157, 23, 139, 117, 181, 44, 197, 130];
    },
    {
      name: "voterWeightRecord";
      discriminator: [46, 249, 155, 75, 153, 248, 116, 9];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "tooMuchExposureToIntegrityPool";
      msg: "Too much exposure to integrity pool";
    },
    {
      code: 6001;
      name: "tooMuchExposureToGovernance";
      msg: "Too much exposure to governance";
    },
    {
      code: 6002;
      name: "tokensNotYetVested";
      msg: "Tokens not yet vested";
    },
    {
      code: 6003;
      name: "riskLimitExceeded";
      msg: "Risk limit exceeded";
    },
    {
      code: 6004;
      name: "tooManyPositions";
      msg: "Number of position limit reached";
    },
    {
      code: 6005;
      name: "positionNotInUse";
      msg: "Position not in use";
    },
    {
      code: 6006;
      name: "createPositionWithZero";
      msg: "New position needs to have positive balance";
    },
    {
      code: 6007;
      name: "closePositionWithZero";
      msg: "Closing a position of 0 is not allowed";
    },
    {
      code: 6008;
      name: "invalidPosition";
      msg: "Invalid product/publisher pair";
    },
    {
      code: 6009;
      name: "amountBiggerThanPosition";
      msg: "Amount to unlock bigger than position";
    },
    {
      code: 6010;
      name: "alreadyUnlocking";
      msg: "Position already unlocking";
    },
    {
      code: 6011;
      name: "zeroEpochDuration";
      msg: "Epoch duration is 0";
    },
    {
      code: 6012;
      name: "withdrawToUnauthorizedAccount";
      msg: "Owner needs to own destination account";
    },
    {
      code: 6013;
      name: "insufficientWithdrawableBalance";
      msg: "Insufficient balance to cover the withdrawal";
    },
    {
      code: 6014;
      name: "wrongTarget";
      msg: "Target in position doesn't match target in instruction data";
    },
    {
      code: 6015;
      name: "genericOverflow";
      msg: "An arithmetic operation unexpectedly overflowed";
    },
    {
      code: 6016;
      name: "negativeBalance";
      msg: "Locked balance must be positive";
    },
    {
      code: 6017;
      name: "frozen";
      msg: "Protocol is frozen";
    },
    {
      code: 6018;
      name: "debuggingOnly";
      msg: "Not allowed when not debugging";
    },
    {
      code: 6019;
      name: "proposalTooLong";
      msg: "Proposal too long";
    },
    {
      code: 6020;
      name: "invalidVotingEpoch";
      msg: "Voting epoch is either too old or hasn't started";
    },
    {
      code: 6021;
      name: "proposalNotActive";
      msg: "Voting hasn't started";
    },
    {
      code: 6022;
      name: "noRemainingAccount";
      msg: "Extra governance account required";
    },
    {
      code: 6023;
      name: "unauthorized";
      msg: "Unauthorized caller";
    },
    {
      code: 6024;
      name: "accountUpgradeFailed";
      msg: "Precondition to upgrade account violated";
    },
    {
      code: 6025;
      name: "notImplemented";
      msg: "Not implemented";
    },
    {
      code: 6026;
      name: "positionSerDe";
      msg: "Error deserializing position";
    },
    {
      code: 6027;
      name: "positionOutOfBounds";
      msg: "Position out of bounds";
    },
    {
      code: 6028;
      name: "voteDuringTransferEpoch";
      msg: "Can't vote during an account's transfer epoch";
    },
    {
      code: 6029;
      name: "notLlcMember";
      msg: "You need to be an LLC member to perform this action";
    },
    {
      code: 6030;
      name: "invalidLlcAgreement";
      msg: "Invalid LLC agreement";
    },
    {
      code: 6031;
      name: "splitZeroTokens";
      msg: "Can't split 0 tokens from an account";
    },
    {
      code: 6032;
      name: "splitTooManyTokens";
      msg: "Can't split more tokens than are in the account";
    },
    {
      code: 6033;
      name: "splitWithStake";
      msg: "Can't split a token account with staking positions. Unstake your tokens first.";
    },
    {
      code: 6034;
      name: "invalidApproval";
      msg: "The approval arguments do not match the split request.";
    },
    {
      code: 6035;
      name: "recoverWithStake";
      msg: "Can't recover account with staking positions. Unstake your tokens first.";
    },
    {
      code: 6036;
      name: "invalidPoolAuthority";
      msg: "The pool authority hasn't been passed or doesn't match the target";
    },
    {
      code: 6037;
      name: "missingTargetAccount";
      msg: "The target account is missing";
    },
    {
      code: 6038;
      name: "invalidSlashRatio";
      msg: "The slash ratio should be between 0 and 1";
    },
    {
      code: 6039;
      name: "unexpectedTargetAccount";
      msg: "The target account is only expected when dealing with the governance target";
    },
    {
      code: 6040;
      name: "other";
      msg: "other";
    },
  ];
  types: [
    {
      name: "globalConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "governanceAuthority";
            type: "pubkey";
          },
          {
            name: "pythTokenMint";
            type: "pubkey";
          },
          {
            name: "pythGovernanceRealm";
            type: "pubkey";
          },
          {
            name: "removedUnlockingDuration";
            type: "u8";
          },
          {
            name: "epochDuration";
            type: "u64";
          },
          {
            name: "freeze";
            type: "bool";
          },
          {
            name: "pdaAuthority";
            type: "pubkey";
          },
          {
            name: "governanceProgram";
            type: "pubkey";
          },
          {
            name: "pythTokenListTime";
            docs: [
              "Once the pyth token is listed, governance can update the config to set this value.",
              "Once this value is set, vesting schedules that depend on the token list date can start",
              "vesting.",
            ];
            type: {
              option: "i64";
            };
          },
          {
            name: "agreementHash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "mockClockTime";
            type: "i64";
          },
          {
            name: "poolAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "maxVoterWeightRecord";
      docs: [
        "Copied this struct from https://github.com/solana-labs/solana-program-library/blob/master/governance/addin-api/src/max_voter_weight.rs",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "realm";
            docs: ["The Realm the MaxVoterWeightRecord belongs to"];
            type: "pubkey";
          },
          {
            name: "governingTokenMint";
            docs: [
              "Governing Token Mint the MaxVoterWeightRecord is associated with",
              "Note: The addin can take deposits of any tokens and is not restricted to the community or",
              "council tokens only",
            ];
            type: "pubkey";
          },
          {
            name: "maxVoterWeight";
            docs: [
              "Max voter weight",
              "The max voter weight provided by the addin for the given realm and governing_token_mint",
            ];
            type: "u64";
          },
          {
            name: "maxVoterWeightExpiry";
            docs: [
              "The slot when the max voting weight expires",
              "It should be set to None if the weight never expires",
              "If the max vote weight decays with time, for example for time locked based weights, then",
              "the expiry must be set As a pattern Revise instruction to update the max weight should",
              "be invoked before governance instruction within the same transaction and the expiry set",
              "to the current slot to provide up to date weight",
            ];
            type: {
              option: "u64";
            };
          },
          {
            name: "reserved";
            docs: ["Reserved space for future versions"];
            type: {
              array: ["u8", 8];
            };
          },
        ];
      };
    },
    {
      name: "position";
      docs: [
        "This represents a staking position, i.e. an amount that someone has staked to a particular",
        "target. This is one of the core pieces of our staking design, and stores all",
        "of the state related to a position The voting position is a position where the",
        "target_with_parameters is VOTING",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "activationEpoch";
            type: "u64";
          },
          {
            name: "unlockingStart";
            type: {
              option: "u64";
            };
          },
          {
            name: "targetWithParameters";
            type: {
              defined: {
                name: "targetWithParameters";
              };
            };
          },
        ];
      };
    },
    {
      name: "positionData";
      docs: ["The header of DynamicPositionArray"];
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "splitRequest";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "stakeAccountMetadataV2";
      docs: [
        "This is the metadata account for each staker",
        'It is derived from the positions account with seeds "stake_metadata" and the positions account',
        "pubkey It stores some PDA bumps, the owner of the account and the vesting schedule",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "metadataBump";
            type: "u8";
          },
          {
            name: "custodyBump";
            type: "u8";
          },
          {
            name: "authorityBump";
            type: "u8";
          },
          {
            name: "voterBump";
            type: "u8";
          },
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "lock";
            type: {
              defined: {
                name: "vestingSchedule";
              };
            };
          },
          {
            name: "nextIndex";
            type: "u8";
          },
          {
            name: "deprecated";
            type: {
              option: "u64";
            };
          },
          {
            name: "signedAgreementHash";
            type: {
              option: {
                array: ["u8", 32];
              };
            };
          },
        ];
      };
    },
    {
      name: "targetMetadata";
      docs: [
        "This represents a target that users can stake to",
        "Currently we store the last time the target account was updated, the current locked balance",
        "and the amount by which the locked balance will change in the next epoch",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "lastUpdateAt";
            type: "u64";
          },
          {
            name: "prevEpochLocked";
            type: "u64";
          },
          {
            name: "locked";
            type: "u64";
          },
          {
            name: "deltaLocked";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "targetWithParameters";
      type: {
        kind: "enum";
        variants: [
          {
            name: "voting";
          },
          {
            name: "integrityPool";
            fields: [
              {
                name: "publisher";
                type: "pubkey";
              },
            ];
          },
        ];
      };
    },
    {
      name: "vestingSchedule";
      docs: [
        "Represents how a given initial balance vests over time",
        "It is unit-less, but units must be consistent",
      ];
      repr: {
        kind: "rust";
      };
      type: {
        kind: "enum";
        variants: [
          {
            name: "fullyVested";
          },
          {
            name: "periodicVesting";
            fields: [
              {
                name: "initialBalance";
                type: "u64";
              },
              {
                name: "startDate";
                type: "i64";
              },
              {
                name: "periodDuration";
                type: "u64";
              },
              {
                name: "numPeriods";
                type: "u64";
              },
            ];
          },
          {
            name: "periodicVestingAfterListing";
            fields: [
              {
                name: "initialBalance";
                type: "u64";
              },
              {
                name: "periodDuration";
                type: "u64";
              },
              {
                name: "numPeriods";
                type: "u64";
              },
            ];
          },
        ];
      };
    },
    {
      name: "voterWeightAction";
      docs: ["The governance action VoterWeight is evaluated for"];
      type: {
        kind: "enum";
        variants: [
          {
            name: "castVote";
          },
          {
            name: "commentProposal";
          },
          {
            name: "createGovernance";
          },
          {
            name: "createProposal";
          },
          {
            name: "signOffProposal";
          },
        ];
      };
    },
    {
      name: "voterWeightRecord";
      docs: [
        "Copied this struct from https://github.com/solana-labs/solana-program-library/blob/master/governance/addin-api/src/voter_weight.rs",
        "Anchor has a macro (vote_weight_record) that is supposed to generate this struct, but it doesn't",
        "work because the error's macros are not updated for anchor 0.22.0.",
        "Even if it did work, the type wouldn't show up in the IDL. SPL doesn't produce an API, which",
        "means that means we'd need the equivalent of this code on the client side.",
        "If Anchor fixes the macro, we might consider changing it",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "realm";
            docs: [
              'VoterWeightRecord discriminator sha256("account:VoterWeightRecord")[..8]',
              "Note: The discriminator size must match the addin implementing program discriminator size",
              "to ensure it's stored in the private space of the account data and it's unique",
              "pub account_discriminator: [u8; 8],",
              "The Realm the VoterWeightRecord belongs to",
            ];
            type: "pubkey";
          },
          {
            name: "governingTokenMint";
            docs: [
              "Governing Token Mint the VoterWeightRecord is associated with",
              "Note: The addin can take deposits of any tokens and is not restricted to the community or",
              "council tokens only",
            ];
            type: "pubkey";
          },
          {
            name: "governingTokenOwner";
            docs: [
              "The owner of the governing token and voter",
              "This is the actual owner (voter) and corresponds to TokenOwnerRecord.governing_token_owner",
            ];
            type: "pubkey";
          },
          {
            name: "voterWeight";
            docs: [
              "Voter's weight",
              "The weight of the voter provided by the addin for the given realm, governing_token_mint and",
              "governing_token_owner (voter)",
            ];
            type: "u64";
          },
          {
            name: "voterWeightExpiry";
            docs: [
              "The slot when the voting weight expires",
              "It should be set to None if the weight never expires",
              "If the voter weight decays with time, for example for time locked based weights, then the",
              "expiry must be set As a common pattern Revise instruction to update the weight should",
              "be invoked before governance instruction within the same transaction and the expiry set",
              "to the current slot to provide up to date weight",
            ];
            type: {
              option: "u64";
            };
          },
          {
            name: "weightAction";
            docs: [
              "The governance action the voter's weight pertains to",
              "It allows to provided voter's weight specific to the particular action the weight is",
              "evaluated for When the action is provided then the governance program asserts the",
              "executing action is the same as specified by the addin",
            ];
            type: {
              option: {
                defined: {
                  name: "voterWeightAction";
                };
              };
            };
          },
          {
            name: "weightActionTarget";
            docs: [
              "The target the voter's weight  action pertains to",
              "It allows to provided voter's weight specific to the target the weight is evaluated for",
              "For example when addin supplies weight to vote on a particular proposal then it must",
              "specify the proposal as the action target When the target is provided then the",
              "governance program asserts the target is the same as specified by the addin",
            ];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "reserved";
            docs: ["Reserved space for future versions"];
            type: {
              array: ["u8", 8];
            };
          },
        ];
      };
    },
  ];
};
