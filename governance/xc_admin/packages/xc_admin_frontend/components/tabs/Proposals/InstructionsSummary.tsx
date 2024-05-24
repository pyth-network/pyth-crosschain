import { PythCluster } from '@pythnetwork/client'
import { MultisigInstruction } from '@pythnetwork/xc-admin-common'
import { getInstructionsSummary } from './utils'

export const InstructionsSummary = ({
  instructions,
  cluster,
}: {
  instructions: MultisigInstruction[]
  cluster: PythCluster
}) => {
  const instructionsCount = getInstructionsSummary({ instructions, cluster })

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
