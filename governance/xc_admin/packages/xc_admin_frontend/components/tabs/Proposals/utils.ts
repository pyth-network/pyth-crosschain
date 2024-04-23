import { PythCluster } from '@pythnetwork/client'
import { AccountMeta } from '@solana/web3.js'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import {
  ExecutePostedVaa,
  MultisigInstruction,
  MultisigParser,
  PythGovernanceActionImpl,
  SetDataSources,
  WormholeMultisigInstruction,
} from 'xc_admin_common'

export type ProposalStatus =
  | 'active'
  | 'executed'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'executeReady'
  | 'draft'
  | 'unkwown'

export const getProposalStatus = (
  proposal: TransactionAccount | undefined,
  multisig: MultisigAccount | undefined
): ProposalStatus => {
  if (multisig && proposal) {
    const onChainStatus = Object.keys(proposal.status)[0]
    return proposal.transactionIndex <= multisig.msChangeIndex &&
      (onChainStatus == 'active' || onChainStatus == 'draft')
      ? 'expired'
      : (onChainStatus as ProposalStatus)
  } else {
    return 'unkwown'
  }
}

/**
 * Sorts the properties of an object by their values in ascending order.
 *
 * @param {Record<string, number>} obj - The object to sort. All property values should be numbers.
 * @returns {Record<string, number>} A new object with the same properties as the input, but ordered such that the property with the largest numerical value comes first.
 *
 * @example
 * const obj = { a: 2, b: 3, c: 1 };
 * const sortedObj = sortObjectByValues(obj);
 * console.log(sortedObj); // Outputs: { b: 3, a: 2, c: 1 }
 */
const sortObjectByValues = (obj: Record<string, number>) => {
  const sortedEntries = Object.entries(obj).sort(([, a], [, b]) => b - a)
  const sortedObj: Record<string, number> = {}
  for (const [key, value] of sortedEntries) {
    sortedObj[key] = value
  }
  return sortedObj
}

/**
 * Returns a summary of the instructions in a list of multisig instructions.
 *
 * @param {MultisigInstruction[]} options.instructions - The list of multisig instructions to summarize.
 * @param {PythCluster} options.cluster - The Pyth cluster to use for parsing instructions.
 * @returns {Record<string, number>} A summary of the instructions, where the keys are the names of the instructions and the values are the number of times each instruction appears in the list.
 */
export const getInstructionsSummary = (options: {
  instructions: MultisigInstruction[]
  cluster: PythCluster
}) => {
  const { instructions, cluster } = options

  return sortObjectByValues(
    instructions.reduce((acc, instruction) => {
      if (instruction instanceof WormholeMultisigInstruction) {
        const governanceAction = instruction.governanceAction
        if (governanceAction instanceof ExecutePostedVaa) {
          const innerInstructions = governanceAction.instructions
          innerInstructions.forEach((innerInstruction) => {
            const multisigParser = MultisigParser.fromCluster(cluster)
            const parsedInstruction = multisigParser.parseInstruction({
              programId: innerInstruction.programId,
              data: innerInstruction.data as Buffer,
              keys: innerInstruction.keys as AccountMeta[],
            })
            acc[parsedInstruction.name] = (acc[parsedInstruction.name] ?? 0) + 1
          })
        } else if (governanceAction instanceof PythGovernanceActionImpl) {
          acc[governanceAction.action] = (acc[governanceAction.action] ?? 0) + 1
        } else if (governanceAction instanceof SetDataSources) {
          acc[governanceAction.actionName] =
            (acc[governanceAction.actionName] ?? 0) + 1
        } else {
          acc['unknown'] = (acc['unknown'] ?? 0) + 1
        }
      } else {
        acc[instruction.name] = (acc[instruction.name] ?? 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
  )
}
