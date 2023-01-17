import { usePythContext } from '../contexts/PythContext'
import ClusterSwitch from './ClusterSwitch'
import Loadbar from './loaders/Loadbar'

function MinPublishers() {
  const { rawConfig, dataIsLoading } = usePythContext()

  return (
    <div className="pt-15 relative lg:pt-20">
      <div className="container flex flex-col items-center justify-between pt-32 lg:flex-row ">
        <div className="mb-10 w-full text-left lg:mb-0">
          <h1 className="h1 mb-3">Min Publishers</h1>
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
            <div className="table-responsive mb-10">
              <table className="w-full bg-darkGray text-left">
                <thead>
                  <tr>
                    <th className="base16 pt-8 pb-6 pl-4 pr-2 font-semibold opacity-60 lg:pl-14">
                      Symbol
                    </th>
                    <th className="base16 pt-8 pb-6 pl-1 pr-2 font-semibold opacity-60 lg:pl-14">
                      Minimum Publishers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rawConfig.mappingAccounts.length ? (
                    rawConfig.mappingAccounts
                      .sort(
                        (mapping1, mapping2) =>
                          mapping2.products.length - mapping1.products.length
                      )[0]
                      .products.map((product) =>
                        product.priceAccounts.map((priceAccount) => {
                          return (
                            <tr
                              key={product.metadata.symbol}
                              className="border-t border-beige-300"
                            >
                              <td className="py-3 pl-4 pr-2 lg:pl-14">
                                {product.metadata.symbol}
                              </td>
                              <td className="py-3 pl-1 lg:pl-14">
                                <span className="mr-2">
                                  {priceAccount.minPub}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )
                  ) : (
                    <tr className="border-t border-beige-300">
                      <td className="py-3 pl-1 lg:pl-14" colSpan={2}>
                        No mapping accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MinPublishers
