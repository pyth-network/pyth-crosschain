import { ProgramType } from '@pythnetwork/xc-admin-common'
import { useProgramContext } from '../../contexts/ProgramContext'
import ProgramSwitch from '../ProgramSwitch'
import PythCore from '../programs/PythCore'
import PythLazer from '../programs/PythLazer'

const General = ({ proposerServerUrl }: { proposerServerUrl: string }) => {
  const { programType } = useProgramContext()

  // Function to render the appropriate program component
  const renderProgramComponent = () => {
    try {
      switch (programType) {
        case ProgramType.PYTH_CORE:
          return <PythCore proposerServerUrl={proposerServerUrl} />
        case ProgramType.PYTH_LAZER:
          return <PythLazer proposerServerUrl={proposerServerUrl} />
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
          <h1 className="h1 mb-4">General</h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        <div className="flex justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex space-x-4 mb-4 items-center">
              <ProgramSwitch />
            </div>
          </div>
        </div>
        {renderProgramComponent()}
      </div>
    </div>
  )
}

export default General
