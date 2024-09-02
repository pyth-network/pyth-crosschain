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
    version: "0.1.0";
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
          name: "sysvarInstructions";
          address: "Sysvar1nstructions1111111111111111111111111";
        },
        {
          name: "permission";
        },
        {
          name: "router";
        }
      ];
      args: [];
    }
  ];
};
