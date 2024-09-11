/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dummy.json`.
 */
export type Dummy = {
  address: "HYCgALnu6CM2gkQVopa1HGaNf8Vzbs9bomWRiKP267P3";
  metadata: {
    name: "dummy";
    version: "0.2.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "doNothing";
      discriminator: [112, 130, 224, 161, 71, 149, 192, 187];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "expressRelay";
          address: "GwEtasTAxdS9neVE4GPUpcwR7DB7AizntQSPcG36ubZM";
        },
        {
          name: "expressRelayMetadata";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
            program: {
              kind: "account";
              path: "expressRelay";
            };
          };
        },
        {
          name: "sysvarInstructions";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "permission";
        },
        {
          name: "router";
        },
        {
          name: "configRouter";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ];
              },
              {
                kind: "account";
                path: "router";
              }
            ];
            program: {
              kind: "account";
              path: "expressRelay";
            };
          };
        },
        {
          name: "accounting";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [97, 99, 99, 111, 117, 110, 116, 105, 110, 103];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "accounting";
      discriminator: [1, 249, 15, 214, 81, 88, 40, 108];
    },
    {
      name: "expressRelayMetadata";
      discriminator: [204, 75, 133, 7, 175, 241, 130, 11];
    }
  ];
  types: [
    {
      name: "accounting";
      type: {
        kind: "struct";
        fields: [
          {
            name: "totalFees";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "expressRelayMetadata";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "relayerSigner";
            type: "pubkey";
          },
          {
            name: "feeReceiverRelayer";
            type: "pubkey";
          },
          {
            name: "splitRouterDefault";
            type: "u64";
          },
          {
            name: "splitRelayer";
            type: "u64";
          }
        ];
      };
    }
  ];
};
