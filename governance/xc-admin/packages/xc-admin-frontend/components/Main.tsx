import { useContext } from 'react'
import { ClusterContext } from '../contexts/ClusterContext'
import { usePythContext } from '../contexts/PythContext'

function Main() {
  const cluster = useContext(ClusterContext)
  const pyth = usePythContext()
  console.log(pyth)
  return (
    <div className="pt-15 relative lg:pt-20">
      <div className="container z-10 flex flex-col items-center justify-between pt-32 lg:flex-row ">
        <div className="mb-10 w-full max-w-lg text-center lg:mb-0 lg:w-1/2 lg:max-w-none lg:text-left">
          <h1 className="h1 mb-3">
            Governance Dashboard {pyth.rawConfig.mappingAccounts.length}
          </h1>
        </div>
      </div>
    </div>
  )
}

export default Main
