import { usePythContext } from '../../contexts/PythContext'
import ClusterSwitch from '../ClusterSwitch'
import Loadbar from '../loaders/Loadbar'

function UpdatePermissions() {
  const { rawConfig, dataIsLoading } = usePythContext()

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Update Permissions</h1>
        </div>
      </div>
      <div className="container">
        <div className="mb-4 md:mb-0">
          <ClusterSwitch />
        </div>
        <div className="table-responsive relative mt-6">
          {dataIsLoading ? (
            <div className="mt-3">
              <Loadbar theme="light" />
            </div>
          ) : (
            <div className="mt-3">
              <p className="h5 mb-8">
                Master Authority:{' '}
                {rawConfig.permissionAccount?.masterAuthority.toBase58()}
              </p>
              <p className="h5 mb-8">
                Data Curation Authority:{' '}
                {rawConfig.permissionAccount?.dataCurationAuthority.toBase58()}
              </p>
              <p className="h5 mb-8">
                Security Authority:{' '}
                {rawConfig.permissionAccount?.securityAuthority.toBase58()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdatePermissions
