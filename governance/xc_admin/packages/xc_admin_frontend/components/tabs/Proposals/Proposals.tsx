import { useRouter } from 'next/router'
import { ProgramType } from '@pythnetwork/xc-admin-common'
import { useProgramContext } from '../../../contexts/ProgramContext'
import ProgramSwitch from '../../ProgramSwitch'
import PythCoreProposals from './PythCoreProposals'
import PythLazerProposals from './PythLazerProposals'

const Proposals = () => {
  const router = useRouter()
  const { programType } = useProgramContext()

  const handleClickBackToProposals = () => {
    delete router.query.proposal
    router.push(
      {
        pathname: router.pathname,
        query: router.query,
      },
      undefined,
      { scroll: false }
    )
  }

  // Function to render the appropriate program component
  const renderProgramComponent = () => {
    try {
      const proposalPubkey = router.query.proposal as string | undefined

      switch (programType) {
        case ProgramType.PYTH_CORE:
          return (
            <PythCoreProposals
              proposalPubkey={proposalPubkey}
              onBackToProposals={handleClickBackToProposals}
            />
          )
        case ProgramType.PYTH_LAZER:
          return (
            <PythLazerProposals
              proposalPubkey={proposalPubkey}
              onBackToProposals={handleClickBackToProposals}
            />
          )
        default:
          return <div>Unknown program type</div>
      }
    } catch (error) {
      console.error('Error rendering program component:', error)
      return <div>An error occurred loading the program component</div>
    }
  }

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">
            {router.query.proposal === undefined ? 'Proposals' : 'Proposal'}
          </h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        <div className="mb-4 md:mb-0">
          <div className="flex space-x-4 mb-4 items-center">
            <ProgramSwitch />
          </div>
        </div>
        {renderProgramComponent()}
      </div>
    </div>
  )
}

export default Proposals
