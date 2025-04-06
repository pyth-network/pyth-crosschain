/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/stake_caps_parameters.json`.
 */
export type StakeCapsParameters = {
  address: "ujSFv8q8woXW5PUnby52PQyxYGUudxkrvgN6A631Qmm";
  metadata: {
    name: "stakeCapsParameters";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "setParameters";
      discriminator: [218, 114, 41, 75, 208, 237, 97, 28];
      accounts: [
        {
          name: "signer";
          writable: true;
          signer: true;
        },
        {
          name: "parameters";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 97, 114, 97, 109, 101, 116, 101, 114, 115];
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
          name: "parameters";
          type: {
            defined: {
              name: "parameters";
            };
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "parameters";
      discriminator: [233, 2, 25, 109, 70, 228, 206, 228];
    },
  ];
  types: [
    {
      name: "parameters";
      type: {
        kind: "struct";
        fields: [
          {
            name: "currentAuthority";
            type: "pubkey";
          },
          {
            name: "m";
            type: "u64";
          },
          {
            name: "z";
            type: "u64";
          },
        ];
      };
    },
  ];
};
