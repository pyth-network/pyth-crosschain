export type PythPushOracle = {
  version: "0.1.0";
  name: "pyth_push_oracle";
  instructions: [
    {
      name: "updatePriceFeed";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "pythSolanaReceiver";
          isMut: false;
          isSigner: false;
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
          name: "priceFeedAccount";
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
          name: "params";
          type: {
            defined: "PostUpdateParams";
          };
        },
        {
          name: "shardId";
          type: "u16";
        },
        {
          name: "feedId";
          type: {
            array: ["u8", 32];
          };
        },
      ];
    },
  ];
  types: [
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
  ];
  errors: [
    {
      code: 6000;
      name: "UpdatesNotMonotonic";
      msg: "Updates must be monotonically increasing";
    },
    {
      code: 6001;
      name: "PriceFeedMessageMismatch";
      msg: "Trying to update price feed with the wrong feed id";
    },
  ];
};

export const IDL: PythPushOracle = {
  version: "0.1.0",
  name: "pyth_push_oracle",
  instructions: [
    {
      name: "updatePriceFeed",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "pythSolanaReceiver",
          isMut: false,
          isSigner: false,
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
          name: "priceFeedAccount",
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
          name: "params",
          type: {
            defined: "PostUpdateParams",
          },
        },
        {
          name: "shardId",
          type: "u16",
        },
        {
          name: "feedId",
          type: {
            array: ["u8", 32],
          },
        },
      ],
    },
  ],
  types: [
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
  ],
  errors: [
    {
      code: 6000,
      name: "UpdatesNotMonotonic",
      msg: "Updates must be monotonically increasing",
    },
    {
      code: 6001,
      name: "PriceFeedMessageMismatch",
      msg: "Trying to update price feed with the wrong feed id",
    },
  ],
};
