export const multicallAbi = {
  type: "function",
  name: "multicall",
  inputs: [
    {
      name: "params",
      type: "tuple",
      internalType: "struct MulticallParams",
      components: [
        {
          name: "sellTokens",
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
          name: "targetCalls",
          type: "tuple[]",
          internalType: "struct TargetCall[]",
          components: [
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
              name: "tokensToSend",
              type: "tuple[]",
              internalType: "struct TokenToSend[]",
              components: [
                {
                  name: "tokenAmount",
                  type: "tuple",
                  internalType: "struct TokenAmount",
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
                  name: "destination",
                  type: "address",
                  internalType: "address",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  outputs: [],
  stateMutability: "payable",
};
