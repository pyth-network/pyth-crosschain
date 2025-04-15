/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/publisher_caps.json`.
 */
export type PublisherCaps = {
  address: "pytcD8uUjPxSLMsNqoVnm9dXQw9tKJJf3CQnGwa8oL7";
  metadata: {
    name: "publisherCaps";
    version: "1.0.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "closePublisherCaps";
      discriminator: [36, 234, 184, 214, 76, 203, 153, 144];
      accounts: [
        {
          name: "writeAuthority";
          signer: true;
          relations: ["publisherCaps"];
        },
        {
          name: "publisherCaps";
          writable: true;
        },
      ];
      args: [];
    },
    {
      name: "initPublisherCaps";
      discriminator: [193, 208, 32, 97, 144, 247, 246, 168];
      accounts: [
        {
          name: "signer";
          signer: true;
        },
        {
          name: "publisherCaps";
          writable: true;
        },
      ];
      args: [];
    },
    {
      name: "verifyPublisherCaps";
      discriminator: [13, 139, 213, 135, 4, 154, 93, 138];
      accounts: [
        {
          name: "signer";
          signer: true;
        },
        {
          name: "publisherCaps";
          writable: true;
        },
        {
          name: "encodedVaa";
          docs: ["which is the recommended way"];
        },
      ];
      args: [
        {
          name: "proof";
          type: {
            vec: {
              array: ["u8", 20];
            };
          };
        },
      ];
    },
    {
      name: "writePublisherCaps";
      discriminator: [142, 26, 237, 82, 9, 200, 27, 97];
      accounts: [
        {
          name: "writeAuthority";
          signer: true;
          relations: ["publisherCaps"];
        },
        {
          name: "publisherCaps";
          writable: true;
        },
      ];
      args: [
        {
          name: "index";
          type: "u32";
        },
        {
          name: "data";
          type: "bytes";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "publisherCaps";
      discriminator: [5, 87, 155, 44, 121, 90, 35, 134];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "invalidWormholeMessage";
    },
    {
      code: 6001;
      name: "invalidMerkleProof";
    },
    {
      code: 6002;
      name: "cantMutateVerifiedPublisherCaps";
    },
    {
      code: 6003;
      name: "dataOverflow";
    },
    {
      code: 6004;
      name: "wrongVaaOwner";
    },
    {
      code: 6005;
      name: "wrongWriteAuthority";
    },
    {
      code: 6006;
      name: "wrongEmitterAddress";
    },
    {
      code: 6007;
      name: "wrongEmitterChain";
    },
    {
      code: 6008;
      name: "wrongDiscriminator";
    },
  ];
  types: [
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
  ];
};
