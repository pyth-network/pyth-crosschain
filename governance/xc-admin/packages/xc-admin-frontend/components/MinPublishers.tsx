import { useContext } from 'react'
import { ClusterContext } from '../contexts/ClusterContext'
import { usePythContext } from '../contexts/PythContext'
import Loadbar from './loaders/Loadbar'

function MinPublishers() {
  const cluster = useContext(ClusterContext)
  const { rawConfig, dataIsLoading } = usePythContext()

  return (
    <div className="pt-15 relative lg:pt-20">
      <div className="container flex flex-col items-center justify-between pt-32 lg:flex-row ">
        <div className="mb-10 w-full text-center lg:mb-0 lg:text-left">
          <h1 className="h1 mb-3">Min Publishers</h1>
        </div>
      </div>
      <div className="container">
        <div className="table-responsive relative z-[2] mt-6">
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
                    rawConfig.mappingAccounts[0].products.map((product) =>
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

const MinPubsRow = ({ symbol, minPub }: { symbol: string; minPub: number }) => {
  return (
    <div>
      <tr key={symbol} className="border-t border-beige hover:bg-beige3">
        <td className="py-3 px-6 text-left md:px-8">
          <span className="inline-flex  items-center  ">
            <span className="hidden cursor-pointer md:block">{symbol}</span>
          </span>
        </td>
      </tr>
      <p className="leading-0 relative block md:text-base18 ">{symbol}</p>
      <small className="leading-0 relative text-sm opacity-60">{minPub}</small>
    </div>
  )
}

export default MinPublishers
