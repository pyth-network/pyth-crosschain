import { PythCluster } from '@pythnetwork/client'
import { PublicKey } from '@solana/web3.js'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import {
  ExecutePostedVaa,
  MultisigInstruction,
  MultisigParser,
  PythGovernanceActionImpl,
  SetDataSources,
  WormholeMultisigInstruction,
} from '@pythnetwork/xc-admin-common'

export const PROPOSAL_STATUSES = [
  'active',
  'executed',
  'cancelled',
  'rejected',
  'expired',
  'executeReady',
  'draft',
  'unkwown',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

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
 * Returns a summary of the instructions in a list of multisig instructions.
 *
 * @param {MultisigInstruction[]} options.instructions - The list of multisig instructions to summarize.
 * @param {PythCluster} options.cluster - The Pyth cluster to use for parsing instructions.
 * @returns {Record<string, number>} A summary of the instructions, where the keys are the names of the instructions and the values are the number of times each instruction appears in the list.
 */
export const getInstructionsSummary = ({
  instructions,
  cluster,
}: {
  instructions: MultisigInstruction[]
  cluster: PythCluster
}) =>
  Object.entries(
    getInstructionSummariesByName(
      MultisigParser.fromCluster(cluster),
      instructions
    )
  )
    .map(([name, summaries = []]) => ({
      name,
      count: summaries.length ?? 0,
      summaries,
    }))
    .toSorted(({ count }) => count)

const getInstructionSummariesByName = (
  parser: MultisigParser,
  instructions: MultisigInstruction[]
) =>
  Object.groupBy(
    instructions.flatMap((instruction) =>
      getInstructionSummary(parser, instruction)
    ),
    ({ name }) => name
  )

const getInstructionSummary = (
  parser: MultisigParser,
  instruction: MultisigInstruction
) => {
  if (instruction instanceof WormholeMultisigInstruction) {
    const { governanceAction } = instruction
    if (governanceAction instanceof ExecutePostedVaa) {
      return governanceAction.instructions.map((innerInstruction) =>
        getTransactionSummary(parser.parseInstruction(innerInstruction))
      )
    } else if (governanceAction instanceof PythGovernanceActionImpl) {
      return [{ name: governanceAction.action } as const]
    } else if (governanceAction instanceof SetDataSources) {
      return [{ name: governanceAction.actionName } as const]
    } else {
      return [{ name: 'unknown' } as const]
    }
  } else {
    return [getTransactionSummary(instruction)]
  }
}

const getTransactionSummary = (instruction: MultisigInstruction) => {
  switch (instruction.name) {
    case 'addPublisher':
      return {
        name: 'addPublisher',
        priceAccount:
          instruction.accounts.named['priceAccount'].pubkey.toBase58(),
        pub: (instruction.args['pub'] as PublicKey).toBase58(),
      } as const
    case 'delPublisher':
      return {
        name: 'delPublisher',
        priceAccount:
          instruction.accounts.named['priceAccount'].pubkey.toBase58(),
        pub: (instruction.args['pub'] as PublicKey).toBase58(),
      } as const
    default:
      return {
        name: instruction.name,
      } as const
  }
}
