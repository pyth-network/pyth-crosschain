/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/integrity_pool.json`.
 */
export type IntegrityPool = {
  address: "pyti8TM4zRVBjmarcgAPmTNNAXYKJv7WVHrkrm6woLN";
  metadata: {
    name: "integrityPool";
    version: "1.0.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "advance";
      discriminator: [7, 56, 108, 201, 36, 20, 57, 89];
      accounts: [
        {
          name: "signer";
          signer: true;
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "publisherCaps";
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "poolRewardCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "poolConfig";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "pool_config.pyth_token_mint";
                account: "poolConfig";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
      ];
      args: [];
    },
    {
      name: "advanceDelegationRecord";
      discriminator: [155, 43, 226, 175, 227, 115, 33, 88];
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
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "poolRewardCustody";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "poolConfig";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "pool_config.pyth_token_mint";
                account: "poolConfig";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
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
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "publisherStakeAccountPositions";
          optional: true;
        },
        {
          name: "publisherStakeAccountCustody";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 117, 115, 116, 111, 100, 121];
              },
              {
                kind: "account";
                path: "publisherStakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "delegationRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "publisher";
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
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
      returns: "u64";
    },
    {
      name: "createSlashEvent";
      discriminator: [7, 214, 12, 127, 239, 247, 253, 117];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "rewardProgramAuthority";
          signer: true;
          relations: ["poolConfig"];
        },
        {
          name: "slashCustody";
          relations: ["poolConfig"];
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "slashEvent";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 108, 97, 115, 104, 95, 101, 118, 101, 110, 116];
              },
              {
                kind: "account";
                path: "publisher";
              },
              {
                kind: "arg";
                path: "index";
              },
            ];
          };
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "index";
          type: "u64";
        },
        {
          name: "slashRatio";
          type: "u64";
        },
      ];
    },
    {
      name: "delegate";
      discriminator: [90, 147, 75, 178, 85, 88, 4, 137];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "configAccount";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakeAccountPositions";
          docs: [
            "CHECK : This AccountInfo is safe because it will checked in staking program",
          ];
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakeAccountCustody";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakingProgram";
          address: "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
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
      ];
    },
    {
      name: "initializePool";
      discriminator: [95, 180, 10, 172, 84, 174, 232, 40];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "configAccount";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
            program: {
              kind: "const";
              value: [
                12,
                74,
                158,
                192,
                43,
                86,
                104,
                29,
                164,
                155,
                4,
                186,
                155,
                36,
                207,
                137,
                253,
                128,
                249,
                44,
                241,
                145,
                227,
                125,
                189,
                51,
                111,
                70,
                231,
                183,
                19,
                217,
              ];
            };
          };
        },
        {
          name: "poolData";
          writable: true;
        },
        {
          name: "poolConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "slashCustody";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "rewardProgramAuthority";
          type: "pubkey";
        },
        {
          name: "y";
          type: "u64";
        },
      ];
    },
    {
      name: "mergeDelegationPositions";
      discriminator: [111, 59, 199, 177, 50, 231, 133, 228];
      accounts: [
        {
          name: "owner";
          docs: [
            "CHECK : This instruction is permissionless, this account will be checked against",
            "stake_account_metadata in the CPI",
          ];
          writable: true;
        },
        {
          name: "poolData";
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "delegationRecord";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "publisher";
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "configAccount";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakeAccountPositions";
          docs: [
            "CHECK : This AccountInfo is safe because it will checked in staking program",
          ];
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakingProgram";
          address: "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
        },
      ];
      args: [];
    },
    {
      name: "setPublisherStakeAccount";
      discriminator: [99, 46, 72, 132, 100, 235, 211, 117];
      accounts: [
        {
          name: "signer";
          signer: true;
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "newStakeAccountPositionsOption";
          optional: true;
        },
        {
          name: "currentStakeAccountPositionsOption";
          optional: true;
        },
      ];
      args: [];
    },
    {
      name: "slash";
      discriminator: [204, 141, 18, 161, 8, 177, 92, 142];
      accounts: [
        {
          name: "signer";
          signer: true;
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "slashEvent";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 108, 97, 115, 104, 95, 101, 118, 101, 110, 116];
              },
              {
                kind: "account";
                path: "publisher";
              },
              {
                kind: "arg";
                path: "index";
              },
            ];
          };
        },
        {
          name: "delegationRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "publisher";
              },
              {
                kind: "account";
                path: "stakeAccountPositions";
              },
            ];
          };
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked in the staking program",
          ];
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "const";
              value: [
                12,
                74,
                158,
                192,
                43,
                86,
                104,
                29,
                164,
                155,
                4,
                186,
                155,
                36,
                207,
                137,
                253,
                128,
                249,
                44,
                241,
                145,
                227,
                125,
                189,
                51,
                111,
                70,
                231,
                183,
                19,
                217,
              ];
            };
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
            program: {
              kind: "const";
              value: [
                12,
                74,
                158,
                192,
                43,
                86,
                104,
                29,
                164,
                155,
                4,
                186,
                155,
                36,
                207,
                137,
                253,
                128,
                249,
                44,
                241,
                145,
                227,
                125,
                189,
                51,
                111,
                70,
                231,
                183,
                19,
                217,
              ];
            };
          };
        },
        {
          name: "configAccount";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
          name: "slashCustody";
          writable: true;
          relations: ["slashEvent"];
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
          name: "stakingProgram";
          address: "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "index";
          type: "u64";
        },
      ];
    },
    {
      name: "undelegate";
      discriminator: [131, 148, 180, 198, 91, 104, 42, 238];
      accounts: [
        {
          name: "owner";
          writable: true;
          signer: true;
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: "publisher";
          docs: [
            "CHECK : The publisher will be checked against data in the pool_data",
          ];
        },
        {
          name: "configAccount";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              },
            ];
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakeAccountPositions";
          writable: true;
        },
        {
          name: "stakeAccountMetadata";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakeAccountCustody";
          docs: ["CHECK : This AccountInfo is safe because it's a checked PDA"];
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
            program: {
              kind: "account";
              path: "stakingProgram";
            };
          };
        },
        {
          name: "stakingProgram";
          address: "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "positionIndex";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "updateDelegationFee";
      discriminator: [197, 184, 73, 246, 24, 137, 184, 208];
      accounts: [
        {
          name: "rewardProgramAuthority";
          signer: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolData";
          writable: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
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
          name: "delegationFee";
          type: "u64";
        },
      ];
    },
    {
      name: "updateRewardProgramAuthority";
      discriminator: [105, 58, 166, 4, 99, 253, 115, 225];
      accounts: [
        {
          name: "rewardProgramAuthority";
          signer: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
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
          name: "rewardProgramAuthority";
          type: "pubkey";
        },
      ];
    },
    {
      name: "updateY";
      discriminator: [224, 14, 232, 96, 41, 230, 183, 18];
      accounts: [
        {
          name: "rewardProgramAuthority";
          signer: true;
          relations: ["poolConfig"];
        },
        {
          name: "poolConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 111, 108, 95, 99, 111, 110, 102, 105, 103];
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
          name: "y";
          type: "u64";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "delegationRecord";
      discriminator: [203, 185, 161, 226, 129, 251, 132, 155];
    },
    {
      name: "globalConfig";
      discriminator: [149, 8, 156, 202, 160, 252, 176, 217];
    },
    {
      name: "poolConfig";
      discriminator: [26, 108, 14, 123, 116, 230, 129, 43];
    },
    {
      name: "poolData";
      discriminator: [155, 28, 220, 37, 221, 242, 70, 167];
    },
    {
      name: "positionData";
      discriminator: [85, 195, 241, 79, 124, 192, 79, 11];
    },
    {
      name: "publisherCaps";
      discriminator: [5, 87, 155, 44, 121, 90, 35, 134];
    },
    {
      name: "slashEvent";
      discriminator: [60, 32, 32, 44, 93, 234, 234, 89];
    },
    {
      name: "targetMetadata";
      discriminator: [157, 23, 139, 117, 181, 44, 197, 130];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "publisherNotFound";
    },
    {
      code: 6001;
      name: "publisherOrRewardAuthorityNeedsToSign";
    },
    {
      code: 6002;
      name: "stakeAccountOwnerNeedsToSign";
    },
    {
      code: 6003;
      name: "outdatedPublisherAccounting";
    },
    {
      code: 6004;
      name: "tooManyPublishers";
    },
    {
      code: 6005;
      name: "unexpectedPositionState";
    },
    {
      code: 6006;
      name: "poolDataAlreadyUpToDate";
    },
    {
      code: 6007;
      name: "outdatedPublisherCaps";
    },
    {
      code: 6008;
      name: "outdatedDelegatorAccounting";
    },
    {
      code: 6009;
      name: "currentStakeAccountShouldBeUndelegated";
    },
    {
      code: 6010;
      name: "newStakeAccountShouldBeUndelegated";
    },
    {
      code: 6011;
      name: "publisherStakeAccountMismatch";
    },
    {
      code: 6012;
      name: "thisCodeShouldBeUnreachable";
    },
    {
      code: 6013;
      name: "insufficientRewards";
    },
    {
      code: 6014;
      name: "invalidStartEpoch";
      msg: "Start epoch of the reward program is before the current epoch";
    },
    {
      code: 6015;
      name: "unverifiedPublisherCaps";
    },
    {
      code: 6016;
      name: "invalidSlashEventIndex";
      msg: "Slash event indexes must be sequential and start at 0";
    },
    {
      code: 6017;
      name: "invalidRewardProgramAuthority";
    },
    {
      code: 6018;
      name: "invalidPoolDataAccount";
    },
    {
      code: 6019;
      name: "wrongSlashEventOrder";
      msg: "Slashes must be executed in order of slash event index";
    },
    {
      code: 6020;
      name: "publisherCustodyAccountRequired";
      msg: "Publisher custody account required";
    },
    {
      code: 6021;
      name: "invalidDelegationFee";
      msg: "Delegation fee must not be greater than 100%";
    },
    {
      code: 6022;
      name: "invalidPublisher";
    },
    {
      code: 6023;
      name: "invalidY";
      msg: "Y should not be greater than 1%";
    },
    {
      code: 6024;
      name: "invalidSlashCustodyAccount";
    },
  ];
  types: [
    {
      name: "delegationRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lastEpoch";
            type: "u64";
          },
          {
            name: "nextSlashEventIndex";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "delegationState";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "totalDelegation";
            type: "u64";
          },
          {
            name: "deltaDelegation";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "event";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "epoch";
            type: "u64";
          },
          {
            name: "y";
            type: "u64";
          },
          {
            name: "extraSpace";
            type: {
              array: ["u64", 7];
            };
          },
          {
            name: "eventData";
            type: {
              array: [
                {
                  defined: {
                    name: "publisherEventData";
                  };
                },
                1024,
              ];
            };
          },
        ];
      };
    },
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
      name: "poolConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "poolData";
            type: "pubkey";
          },
          {
            name: "rewardProgramAuthority";
            type: "pubkey";
          },
          {
            name: "pythTokenMint";
            type: "pubkey";
          },
          {
            name: "y";
            type: "u64";
          },
          {
            name: "slashCustody";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "poolData";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "lastUpdatedEpoch";
            type: "u64";
          },
          {
            name: "claimableRewards";
            type: "u64";
          },
          {
            name: "publishers";
            type: {
              array: ["pubkey", 1024];
            };
          },
          {
            name: "delState";
            type: {
              array: [
                {
                  defined: {
                    name: "delegationState";
                  };
                },
                1024,
              ];
            };
          },
          {
            name: "selfDelState";
            type: {
              array: [
                {
                  defined: {
                    name: "delegationState";
                  };
                },
                1024,
              ];
            };
          },
          {
            name: "publisherStakeAccounts";
            type: {
              array: ["pubkey", 1024];
            };
          },
          {
            name: "events";
            type: {
              array: [
                {
                  defined: {
                    name: "event";
                  };
                },
                52,
              ];
            };
          },
          {
            name: "numEvents";
            type: "u64";
          },
          {
            name: "numSlashEvents";
            type: {
              array: ["u64", 1024];
            };
          },
          {
            name: "delegationFees";
            type: {
              array: ["u64", 1024];
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
      name: "publisherCaps";
      serialization: "bytemuck";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "pubkey";
          },
          {
            name: "isVerified";
            type: "u8";
          },
          {
            name: "padding";
            type: {
              array: ["u8", 4];
            };
          },
          {
            name: "publisherCapsMessageBuffer";
            type: {
              array: ["u8", 40_971];
            };
          },
        ];
      };
    },
    {
      name: "publisherEventData";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "selfRewardRatio";
            type: "u64";
          },
          {
            name: "otherRewardRatio";
            type: "u64";
          },
          {
            name: "delegationFee";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "slashEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "epoch";
            type: "u64";
          },
          {
            name: "slashRatio";
            type: "u64";
          },
          {
            name: "slashCustody";
            type: "pubkey";
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
  ];
};
