import Web3 from 'web3'

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
]

type Input = {
  internalType: string
  name: string
  type: string
}

// callData in hex format
export function parseEvmExecuteCallData(callData: string):
  | {
      method: string
      inputs: [string, unknown][]
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
      inputs: inputs.map((input) => [input.name, decodedParams[input.name]]),
    }
  }

  return undefined
}
