export const executeOpportunityAbi = {
  type: "function",
  name: "executeOpportunity",
  inputs: [
    {
      name: "params",
      type: "tuple",
      internalType: "struct ExecutionParams",
      components: [
        {
          name: "permit",
          type: "tuple",
          internalType: "struct ISignatureTransfer.PermitBatchTransferFrom",
          components: [
            {
              name: "permitted",
              type: "tuple[]",
              internalType: "struct ISignatureTransfer.TokenPermissions[]",
              components: [
                {
                  name: "token",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "nonce",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "deadline",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
        {
          name: "witness",
          type: "tuple",
          internalType: "struct ExecutionWitness",
          components: [
            {
              name: "buyTokens",
              type: "tuple[]",
              internalType: "struct TokenAmount[]",
              components: [
                {
                  name: "token",
                  type: "address",
                  internalType: "address",
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256",
                },
              ],
            },
            {
              name: "executor",
              type: "address",
              internalType: "address",
            },
            {
              name: "targetContract",
              type: "address",
              internalType: "address",
            },
            {
              name: "targetCalldata",
              type: "bytes",
              internalType: "bytes",
            },
            {
              name: "targetCallValue",
              type: "uint256",
              internalType: "uint256",
            },
            {
              name: "bidAmount",
              type: "uint256",
              internalType: "uint256",
            },
          ],
        },
      ],
    },
    {
      name: "signature",
      type: "bytes",
      internalType: "bytes",
    },
  ],
  outputs: [],
  stateMutability: "payable",
};
