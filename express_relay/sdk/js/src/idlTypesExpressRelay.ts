/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/express_relay.json`.
 */
export type ExpressRelay = {
  address: "GwEtasTAxdS9neVE4GPUpcwR7DB7AizntQSPcG36ubZM";
  metadata: {
    name: "expressRelay";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "checkPermission";
      discriminator: [154, 199, 232, 242, 96, 72, 197, 236];
      accounts: [
        {
          name: "sysvarInstructions";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "permission";
        },
        {
          name: "protocol";
        }
      ];
      args: [];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        },
        {
          name: "admin";
        },
        {
          name: "relayerSigner";
        },
        {
          name: "feeReceiverRelayer";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "initializeArgs";
            };
          };
        }
      ];
    },
    {
      name: "setAdmin";
      discriminator: [251, 163, 0, 52, 91, 194, 187, 92];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        },
        {
          name: "adminNew";
        }
      ];
      args: [];
    },
    {
      name: "setProtocolSplit";
      discriminator: [73, 64, 68, 216, 180, 55, 255, 62];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "protocolConfig";
          writable: true;
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
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ];
              },
              {
                kind: "account";
                path: "protocol";
              }
            ];
          };
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
          };
        },
        {
          name: "protocol";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "setProtocolSplitArgs";
            };
          };
        }
      ];
    },
    {
      name: "setRelayer";
      discriminator: [23, 243, 33, 88, 110, 84, 196, 37];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        },
        {
          name: "relayerSigner";
        },
        {
          name: "feeReceiverRelayer";
        }
      ];
      args: [];
    },
    {
      name: "setSplits";
      discriminator: [175, 2, 86, 49, 225, 202, 232, 189];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "setSplitsArgs";
            };
          };
        }
      ];
    },
    {
      name: "submitBid";
      discriminator: [19, 164, 237, 254, 64, 139, 237, 93];
      accounts: [
        {
          name: "searcher";
          writable: true;
          signer: true;
        },
        {
          name: "relayerSigner";
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "permission";
        },
        {
          name: "protocol";
        },
        {
          name: "protocolConfig";
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
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ];
              },
              {
                kind: "account";
                path: "protocol";
              }
            ];
          };
        },
        {
          name: "feeReceiverRelayer";
          writable: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "feeReceiverProtocol";
          writable: true;
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "sysvarInstructions";
          address: "Sysvar1nstructions1111111111111111111111111";
        }
      ];
      args: [
        {
          name: "data";
          type: {
            defined: {
              name: "submitBidArgs";
            };
          };
        }
      ];
    },
    {
      name: "withdrawFees";
      discriminator: [198, 212, 171, 109, 144, 215, 174, 89];
      accounts: [
        {
          name: "admin";
          writable: true;
          signer: true;
          relations: ["expressRelayMetadata"];
        },
        {
          name: "feeReceiverAdmin";
          writable: true;
        },
        {
          name: "expressRelayMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              }
            ];
          };
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "configProtocol";
      discriminator: [171, 115, 146, 215, 235, 130, 24, 202];
    },
    {
      name: "expressRelayMetadata";
      discriminator: [204, 75, 133, 7, 175, 241, 130, 11];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "feeSplitLargerThanPrecision";
      msg: "Fee split(s) larger than fee precision";
    },
    {
      code: 6001;
      name: "feesHigherThanBid";
      msg: "Fees higher than bid";
    },
    {
      code: 6002;
      name: "deadlinePassed";
      msg: "Deadline passed";
    },
    {
      code: 6003;
      name: "invalidCpiSubmitBid";
      msg: "Invalid CPI into submit bid instruction";
    },
    {
      code: 6004;
      name: "missingPermission";
      msg: "Missing permission";
    },
    {
      code: 6005;
      name: "insufficientSearcherFunds";
      msg: "Insufficient Searcher Funds";
    },
    {
      code: 6006;
      name: "insufficientProtocolFeeReceiverRent";
      msg: "Insufficient protocol fee receiver funds for rent";
    },
    {
      code: 6007;
      name: "insufficientRelayerFeeReceiverRent";
      msg: "Insufficient relayer fee receiver funds for rent";
    },
    {
      code: 6008;
      name: "invalidPdaProvided";
      msg: "Invalid PDA provided";
    }
  ];
  types: [
    {
      name: "configProtocol";
      type: {
        kind: "struct";
        fields: [
          {
            name: "protocol";
            type: "pubkey";
          },
          {
            name: "split";
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
            name: "splitProtocolDefault";
            type: "u64";
          },
          {
            name: "splitRelayer";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "initializeArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "splitProtocolDefault";
            type: "u64";
          },
          {
            name: "splitRelayer";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "setProtocolSplitArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "splitProtocol";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "setSplitsArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "splitProtocolDefault";
            type: "u64";
          },
          {
            name: "splitRelayer";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "submitBidArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "deadline";
            type: "i64";
          },
          {
            name: "bidAmount";
            type: "u64";
          }
        ];
      };
    }
  ];
};
