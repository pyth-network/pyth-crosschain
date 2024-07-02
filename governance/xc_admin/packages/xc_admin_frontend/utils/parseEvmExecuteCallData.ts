import Web3 from 'web3'

// Note: Currently, the ABI only contains the functions which take in primitives as inputs.
// Though it is possible for EVM functions to accept structs as one of the inputs.
// We don't support that right now. There is no requirement for that now or in the
// foreseeable future. Adding it now will add unnecessary complexity.
// It will be added when needed.
const ABI = [
  {
    inputs: [],
    name: 'acceptOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'acceptAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newImplementation',
        type: 'address',
      },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    type: 'function',
    name: 'setRelayer',
    inputs: [
      {
        name: 'relayer',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

type Input = {
  internalType: string
  name: string
  type: string
}

/**
 * Parses the call data for an EVM contract call only if the call data matches one of the entry in ABI.
 * If there is a match, the method name and inputs are returned. Else, undefined is returned.
 * @param callData The call data in hex format.
 * @returns The parsed call data or undefined.
 */
export function parseEvmExecuteCallData(callData: string):
  | {
      method: string
      inputs: [string, string][]
    }
  | undefined {
  for (const abi of ABI) {
    const web3 = new Web3()
    const methodSignature = web3.eth.abi
      .encodeFunctionSignature(abi)
      .replace('0x', '')

    if (!callData.includes(methodSignature)) {
      continue
    }

    const inputs: Input[] = abi.inputs

    const decodedParams = web3.eth.abi.decodeParameters(
      inputs.map((input) => ({
        type: input.type,
        name: input.name,
      })),
      callData.replace(methodSignature, '')
    )
    return {
      method: abi.name,
      inputs: inputs.map((input) => [
        input.name,
        decodedParams[input.name] as string,
      ]),
    }
  }

  return undefined
}
