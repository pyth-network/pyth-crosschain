import { PythCluster } from '@pythnetwork/client'
import { AccountMeta } from '@solana/web3.js'
import {
  ExecutePostedVaa,
  MultisigInstruction,
  MultisigParser,
  PythGovernanceActionImpl,
  WormholeMultisigInstruction,
  SetDataSources,
} from 'xc_admin_common'

export const InstructionsSummary = ({
  instructions,
  cluster,
}: {
  instructions: MultisigInstruction[]
  cluster: PythCluster
}) => {
  const instructionsCount = instructions.reduce((acc, instruction) => {
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

  return (
    <div className="space-y-4">
      {Object.entries(instructionsCount).map(([name, count]) => {
        return (
          <div key={name}>
            {name}: {count}
          </div>
        )
      })}
    </div>
  )
}
