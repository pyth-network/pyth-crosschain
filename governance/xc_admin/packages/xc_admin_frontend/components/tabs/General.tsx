import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { getPythProgramKeyForCluster } from '@pythnetwork/client'
import { PythOracle, pythOracleProgram } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import { useMultisig } from '../../hooks/useMultisig'
import { PriceRawConfig } from '../../hooks/usePyth'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'

const General = () => {
  const [data, setData] = useState<any>({})
  const [dataChanges, setDataChanges] = useState<Record<string, any>>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const anchorWallet = useAnchorWallet()
  const { isLoading: isMultisigLoading, squads } = useMultisig(
    anchorWallet as Wallet
  )
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const { connected } = useWallet()
  const [pythProgramClient, setPythProgramClient] =
    useState<Program<PythOracle>>()

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const sortData = (data: any) => {
    const sortedData: any = {}
    Object.keys(data)
      .sort()
      .forEach((key) => {
        const sortedInnerData: any = {}
        Object.keys(data[key])
          .sort()
          .forEach((innerKey) => {
            if (innerKey === 'metadata') {
              sortedInnerData[innerKey] = sortObjectByKeys(data[key][innerKey])
            } else if (innerKey === 'priceAccounts') {
              // sort price accounts by address
              sortedInnerData[innerKey] = data[key][innerKey].sort(
                (
                  priceAccount1: PriceRawConfig,
                  priceAccount2: PriceRawConfig
                ) =>
                  priceAccount1.address
                    .toBase58()
                    .localeCompare(priceAccount2.address.toBase58())
              )
              // sort price accounts keys
              sortedInnerData[innerKey] = sortedInnerData[innerKey].map(
                (priceAccount: any) => {
                  const sortedPriceAccount: any = {}
                  Object.keys(priceAccount)
                    .sort()
                    .forEach((priceAccountKey) => {
                      if (priceAccountKey === 'publishers') {
                        sortedPriceAccount[priceAccountKey] = priceAccount[
                          priceAccountKey
                        ].sort((pub1: string, pub2: string) =>
                          pub1.localeCompare(pub2)
                        )
                      } else {
                        sortedPriceAccount[priceAccountKey] =
                          priceAccount[priceAccountKey]
                      }
                    })
                  return sortedPriceAccount
                }
              )
            } else {
              sortedInnerData[innerKey] = data[key][innerKey]
            }
          })
        sortedData[key] = sortedInnerData
      })
    return sortedData
  }
  const sortDataMemo = useCallback(sortData, [])

  useEffect(() => {
    if (!dataIsLoading && rawConfig && rawConfig.mappingAccounts.length > 0) {
      const symbolToData: any = {}
      rawConfig.mappingAccounts
        .sort(
          (mapping1, mapping2) =>
            mapping2.products.length - mapping1.products.length
        )[0]
        .products.sort((product1, product2) =>
          product1.metadata.symbol.localeCompare(product2.metadata.symbol)
        )
        .map((product) => {
          symbolToData[product.metadata.symbol] = {
            address: product.address.toBase58(),
            metadata: {
              ...product.metadata,
            },
            priceAccounts: product.priceAccounts.map((p) => ({
              address: p.address.toBase58(),
              publishers: p.publishers.map((p) => p.toBase58()),
              expo: p.expo,
              minPub: p.minPub,
            })),
          }
          // these fields are immutable and should not be updated
          delete symbolToData[product.metadata.symbol].metadata.symbol
          delete symbolToData[product.metadata.symbol].metadata.price_account
        })
      setData(sortDataMemo(symbolToData))
    }
  }, [rawConfig, dataIsLoading, sortDataMemo])

  const sortObjectByKeys = (obj: any) => {
    const sortedObj: any = {}
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sortedObj[key] = obj[key]
      })
    return sortedObj
  }

  // function to download json file
  const handleDownloadJsonButtonClick = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `data-${cluster}.json`)
    document.body.appendChild(downloadAnchor) // required for firefox
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // function to upload json file and update changes state
  const handleUploadJsonButtonClick = () => {
    const uploadAnchor = document.createElement('input')
    uploadAnchor.setAttribute('type', 'file')
    uploadAnchor.setAttribute('accept', '.json')
    uploadAnchor.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files![0]
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target) {
          const fileData = e.target.result
          if (!isValidJson(fileData as string)) return
          const fileDataParsed = sortData(JSON.parse(fileData as string))
          const changes: Record<string, any> = {}
          Object.keys(fileDataParsed).forEach((symbol) => {
            if (
              JSON.stringify(data[symbol]) !==
              JSON.stringify(fileDataParsed[symbol])
            ) {
              changes[symbol] = { prev: {}, new: {} }
              changes[symbol].prev = data[symbol]
              changes[symbol].new = fileDataParsed[symbol]
            }
          })
          setDataChanges(changes)
          openModal()
        }
      }
      reader.readAsText(file)
    })
    document.body.appendChild(uploadAnchor) // required for firefox
    uploadAnchor.click()
    uploadAnchor.remove()
  }

  // check if uploaded json is valid json
  const isValidJson = (json: string) => {
    try {
      JSON.parse(json)
    } catch (e: any) {
      toast.error(capitalizeFirstLetter(e.message))
      return false
    }
    // check if json keys are existing products
    const jsonParsed = JSON.parse(json)
    const jsonSymbols = Object.keys(jsonParsed)
    const existingSymbols = Object.keys(data)
    // check that jsonSymbols is equal to existingSymbols no matter the order
    if (
      JSON.stringify(jsonSymbols.sort()) !==
      JSON.stringify(existingSymbols.sort())
    ) {
      toast.error('Symbols in json file do not match existing symbols!')
      return false
    }
    return true
  }

  const AddressChangesRow = ({ changes }: { changes: any }) => {
    const key = 'address'
    return (
      <>
        {changes.prev !== changes.new && (
          <tr key={key}>
            <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
              {key
                .split('_')
                .map((word) => capitalizeFirstLetter(word))
                .join(' ')}
            </td>
            <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
              <s>{changes.prev}</s>
              <br />
              {changes.new}
            </td>
          </tr>
        )}
      </>
    )
  }

  const MetadataChangesRows = ({ changes }: { changes: any }) => {
    return (
      <>
        {Object.keys(changes.new).map(
          (metadataKey) =>
            changes.prev[metadataKey] !== changes.new[metadataKey] && (
              <tr key={metadataKey}>
                <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                  {metadataKey
                    .split('_')
                    .map((word) => capitalizeFirstLetter(word))
                    .join(' ')}
                </td>

                <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                  <s>{changes.prev[metadataKey]}</s>
                  <br />
                  {changes.new[metadataKey]}
                </td>
              </tr>
            )
        )}
      </>
    )
  }

  const PriceAccountsChangesRows = ({ changes }: { changes: any }) => {
    return (
      <>
        {changes.new.map((priceAccount: any, index: number) =>
          Object.keys(priceAccount).map((priceAccountKey) =>
            priceAccountKey === 'publishers' &&
            JSON.stringify(changes.prev[index][priceAccountKey]) !==
              JSON.stringify(priceAccount[priceAccountKey]) ? (
              <PublisherKeysChangesRows
                key={priceAccountKey}
                changes={{
                  prev: changes.prev[index][priceAccountKey],
                  new: priceAccount[priceAccountKey],
                }}
              />
            ) : (
              priceAccountKey !== 'publishers' &&
              changes.prev[index][priceAccountKey] !==
                priceAccount[priceAccountKey] && (
                <tr key={priceAccountKey}>
                  <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                    {priceAccountKey

                      .split('_')
                      .map((word) => capitalizeFirstLetter(word))
                      .join(' ')}
                  </td>
                  <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                    <s>{changes.prev[index][priceAccountKey]}</s>
                    <br />
                    {priceAccount[priceAccountKey]}
                  </td>
                </tr>
              )
            )
          )
        )}
      </>
    )
  }

  const PublisherKeysChangesRows = ({ changes }: { changes: any }) => {
    const publisherKeysToAdd = changes.new.filter(
      (newPublisher: string) => !changes.prev.includes(newPublisher)
    )
    const publisherKeysToRemove = changes.prev.filter(
      (prevPublisher: string) => !changes.new.includes(prevPublisher)
    )
    return (
      <>
        {publisherKeysToAdd.length > 0 && (
          <tr>
            <td className="py-3 pl-6 pr-1 lg:pl-6">Add Publisher(s)</td>
            <td className="py-3 pl-1 pr-8 lg:pl-6">
              {publisherKeysToAdd.map((publisherKey: string) => (
                <span key={publisherKey} className="block">
                  {publisherKey}
                </span>
              ))}
            </td>
          </tr>
        )}
        {publisherKeysToRemove.length > 0 && (
          <tr>
            <td className="py-3 pl-6 pr-1 lg:pl-6">Remove Publisher(s)</td>
            <td className="py-3 pl-1 pr-8 lg:pl-6">
              {publisherKeysToRemove.map((publisherKey: string) => (
                <span key={publisherKey} className="block">
                  {publisherKey}
                </span>
              ))}
            </td>
          </tr>
        )}
      </>
    )
  }

  const ModalContent = ({ changes }: { changes: any }) => {
    return (
      <>
        {Object.keys(changes).length > 0 ? (
          <table className="mb-10 w-full table-auto bg-darkGray text-left">
            {/* compare changes.prev and changes.new and display the fields that are different */}
            {Object.keys(changes).map((key) => {
              const { prev, new: newChanges } = changes[key]
              const diff = Object.keys(prev).filter(
                (k) => JSON.stringify(prev[k]) !== JSON.stringify(newChanges[k])
              )
              return (
                <tbody key={key}>
                  <tr>
                    <td
                      className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                      colSpan={2}
                    >
                      {key}
                    </td>
                  </tr>
                  {diff.map((k) =>
                    k === 'address' ? (
                      <AddressChangesRow
                        key={k}
                        changes={{ prev: prev[k], new: newChanges[k] }}
                      />
                    ) : k === 'metadata' ? (
                      <MetadataChangesRows
                        key={k}
                        changes={{ prev: prev[k], new: newChanges[k] }}
                      />
                    ) : k === 'priceAccounts' ? (
                      <PriceAccountsChangesRows
                        key={k}
                        changes={{
                          prev: prev[k],
                          new: newChanges[k],
                        }}
                      />
                    ) : null
                  )}

                  {/* add a divider only if its not the last item */}
                  {Object.keys(changes).indexOf(key) !==
                  Object.keys(changes).length - 1 ? (
                    <tr>
                      <td className="base16 py-4 pl-6 pr-6" colSpan={2}>
                        <hr className="border-gray-700" />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              )
            })}
          </table>
        ) : (
          <p className="mb-8 leading-6">No proposed changes.</p>
        )}
        {Object.keys(changes).length > 0 ? (
          !connected ? (
            <div className="flex justify-center">
              <WalletModalButton className="action-btn text-base" />
            </div>
          ) : (
            <button
              className="action-btn text-base"
              //   onClick={handleSendProposalButtonClick}
            >
              {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
            </button>
          )
        ) : null}
      </>
    )
  }

  // create anchor wallet when connected
  useEffect(() => {
    if (connected) {
      const provider = new AnchorProvider(
        connection,
        anchorWallet as Wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )
    }
  }, [anchorWallet, connection, connected, cluster])

  return (
    <div className="relative">
      <Modal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        closeModal={closeModal}
        content={<ModalContent changes={dataChanges} />}
      />
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">General</h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        <div className="flex justify-between">
          <div className="mb-4 md:mb-0">
            <ClusterSwitch />
          </div>
        </div>
        <div className="relative mt-6">
          {dataIsLoading ? (
            <div className="mt-3">
              <Loadbar theme="light" />
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="mb-10">
                <button
                  className="action-btn text-base"
                  onClick={handleDownloadJsonButtonClick}
                >
                  Download JSON
                </button>
              </div>
              <div className="mb-10">
                <button
                  className="action-btn text-base"
                  onClick={handleUploadJsonButtonClick}
                >
                  Upload JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default General
