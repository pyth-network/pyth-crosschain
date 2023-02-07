import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { getPythProgramKeyForCluster } from '@pythnetwork/client'
import { PythOracle, pythOracleProgram } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getMultisigCluster,
  OPS_KEY,
  proposeInstructions,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import { SECURITY_MULTISIG, useMultisig } from '../../hooks/useMultisig'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'

const General = () => {
  const [data, setData] = useState<any>({})
  const [dataChanges, setDataChanges] = useState<Record<string, any>>()
  const [existingSymbols, setExistingSymbols] = useState<Set<string>>(new Set())
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
                (priceAccount1: any, priceAccount2: any) =>
                  priceAccount1.address.localeCompare(priceAccount2.address)
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
            priceAccounts: {
              address: product.priceAccounts[0].address.toBase58(),
              publishers: product.priceAccounts[0].publishers.map((p) =>
                p.toBase58()
              ),
              expo: product.priceAccounts[0].expo,
              minPub: product.priceAccounts[0].minPub,
            },
          }
          // these fields are immutable and should not be updated
          delete symbolToData[product.metadata.symbol].address
          delete symbolToData[product.metadata.symbol].priceAccounts[0].address
          delete symbolToData[product.metadata.symbol].metadata.symbol
          delete symbolToData[product.metadata.symbol].metadata.price_account
        })
      setExistingSymbols(new Set(Object.keys(symbolToData)))
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
            if (!existingSymbols.has(symbol)) {
              // if symbol is not in existing symbols, create new entry
              changes[symbol] = { new: {} }
              changes[symbol].new = { ...fileDataParsed[symbol] }
              // these fields are generated deterministically and should not be updated
              delete changes[symbol].new.address
              delete changes[symbol].new.priceAccounts[0].address
            } else if (
              // if symbol is in existing symbols, check if data is different
              JSON.stringify(data[symbol]) !==
              JSON.stringify(fileDataParsed[symbol])
            ) {
              changes[symbol] = { prev: {}, new: {} }
              changes[symbol].prev = { ...data[symbol] }
              changes[symbol].new = { ...fileDataParsed[symbol] }
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
    return true
  }

  const handleSendProposalButtonClick = async () => {
    if (pythProgramClient && dataChanges) {
      const instructions: TransactionInstruction[] = []
      Object.keys(dataChanges).forEach(async (symbol) => {
        const { prev, new: newChanges } = dataChanges[symbol]
        // if prev is undefined, it means that the symbol is new
        if (!prev) {
          // deterministically generate product account key
          const productAccountKey = await PublicKey.createWithSeed(
            OPS_KEY,
            'product:' + symbol,
            pythProgramClient.programId
          )
          // create add product account instruction
          instructions.push(
            await pythProgramClient.methods
              .addProduct()
              .accounts({
                fundingAccount: squads?.getAuthorityPDA(
                  SECURITY_MULTISIG[getMultisigCluster(cluster)],
                  1
                ),
                tailMappingAccount: rawConfig.mappingAccounts[0].address,
                productAccount: productAccountKey,
              })
              .instruction()
          )
          // create update product account instruction
          instructions.push(
            await pythProgramClient.methods
              .updProduct({ ...newChanges.metadata, symbol: symbol })
              .accounts({
                fundingAccount: squads?.getAuthorityPDA(
                  SECURITY_MULTISIG[getMultisigCluster(cluster)],
                  1
                ),
                productAccount: productAccountKey,
              })
              .instruction()
          )
          // deterministically generate price account key
          const priceAccountKey = await PublicKey.createWithSeed(
            OPS_KEY,
            'price:' + symbol,
            pythProgramClient.programId
          )
          // create add price account instruction
          instructions.push(
            await pythProgramClient.methods
              .addPrice(newChanges.priceAccounts[0].expo, 1)
              .accounts({
                fundingAccount: squads?.getAuthorityPDA(
                  SECURITY_MULTISIG[getMultisigCluster(cluster)],
                  1
                ),
                productAccount: productAccountKey,
                priceAccount: priceAccountKey,
              })
              .instruction()
          )

          // create add publisher instruction if there are any publishers
          if (newChanges.priceAccounts[0].publishers.length > 0) {
            newChanges.priceAccounts[0].publishers.forEach(
              (publisherKey: string) => {
                pythProgramClient.methods
                  .addPublisher(new PublicKey(publisherKey))
                  .accounts({
                    fundingAccount: squads?.getAuthorityPDA(
                      SECURITY_MULTISIG[getMultisigCluster(cluster)],
                      1
                    ),
                    priceAccount: priceAccountKey,
                  })
                  .instruction()
                  .then((instruction) => instructions.push(instruction))
              }
            )
          }

          // create set min publisher instruction if there are any publishers
          if (newChanges.priceAccounts[0].minPub !== undefined) {
            instructions.push(
              await pythProgramClient.methods
                .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
                .accounts({
                  priceAccount: priceAccountKey,
                  fundingAccount: squads?.getAuthorityPDA(
                    SECURITY_MULTISIG[getMultisigCluster(cluster)],
                    1
                  ),
                })
                .instruction()
            )
          }
        } else {
          // check if metadata has changed
          if (
            JSON.stringify(prev.metadata) !==
            JSON.stringify(newChanges.metadata)
          ) {
            // create update product account instruction
            instructions.push(
              await pythProgramClient.methods
                .updProduct({ ...newChanges.metadata, symbol: symbol })
                .accounts({
                  fundingAccount: squads?.getAuthorityPDA(
                    SECURITY_MULTISIG[getMultisigCluster(cluster)],
                    1
                  ),
                  productAccount: new PublicKey(prev.address),
                })
                .instruction()
            )
          }
          // check if minPub has changed
          if (
            prev.priceAccounts[0].minPub !== newChanges.priceAccounts[0].minPub
          ) {
            // create update product account instruction
            instructions.push(
              await pythProgramClient.methods
                .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
                .accounts({
                  priceAccount: new PublicKey(prev.priceAccounts[0].address),
                  fundingAccount: squads?.getAuthorityPDA(
                    SECURITY_MULTISIG[getMultisigCluster(cluster)],
                    1
                  ),
                })
                .instruction()
            )
          }

          // check if publishers have changed
          const publisherKeysToAdd =
            newChanges.priceAccounts[0].publishers.filter(
              (newPublisher: string) =>
                !prev.priceAccounts[0].publishers.includes(newPublisher)
            )
          // check if there are any publishers to remove by comparing prev and new
          const publisherKeysToRemove = prev.priceAccounts[0].publishers.filter(
            (prevPublisher: string) =>
              !newChanges.priceAccounts[0].publishers.includes(prevPublisher)
          )

          // add instructions to add new publishers
          publisherKeysToAdd.forEach((publisherKey: string) => {
            pythProgramClient.methods
              .addPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount: squads?.getAuthorityPDA(
                  SECURITY_MULTISIG[getMultisigCluster(cluster)],
                  1
                ),
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction()
              .then((instruction) => instructions.push(instruction))
          })
          // add instructions to remove publishers
          publisherKeysToRemove.forEach((publisherKey: string) => {
            pythProgramClient.methods
              .delPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount: squads?.getAuthorityPDA(
                  SECURITY_MULTISIG[getMultisigCluster(cluster)],
                  1
                ),
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction()
              .then((instruction) => instructions.push(instruction))
          })
        }
      })
      if (!isMultisigLoading && squads) {
        setIsSendProposalButtonLoading(true)
        try {
          const proposalPubkey = await proposeInstructions(
            squads,
            SECURITY_MULTISIG[getMultisigCluster(cluster)],
            instructions,
            false
          )
          toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
          setIsSendProposalButtonLoading(false)
        } catch (e: any) {
          toast.error(capitalizeFirstLetter(e.message))
          setIsSendProposalButtonLoading(false)
        }
      }
    }
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
    const addNewPriceFeed =
      changes.prev === undefined && changes.new !== undefined

    return (
      <>
        {Object.keys(changes.new).map(
          (metadataKey) =>
            (addNewPriceFeed ||
              changes.prev[metadataKey] !== changes.new[metadataKey]) && (
              <tr key={metadataKey}>
                <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                  {metadataKey
                    .split('_')
                    .map((word) => capitalizeFirstLetter(word))
                    .join(' ')}
                </td>

                <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                  {!addNewPriceFeed ? (
                    <>
                      <s>{changes.prev[metadataKey]}</s>
                      <br />{' '}
                    </>
                  ) : null}
                  {changes.new[metadataKey]}
                </td>
              </tr>
            )
        )}
      </>
    )
  }

  const PriceAccountsChangesRows = ({ changes }: { changes: any }) => {
    const addNewPriceFeed =
      changes.prev === undefined && changes.new !== undefined
    return (
      <>
        {changes.new.map((priceAccount: any, index: number) =>
          Object.keys(priceAccount).map((priceAccountKey) =>
            priceAccountKey === 'publishers' ? (
              addNewPriceFeed ? (
                <PublisherKeysChangesRows
                  key={priceAccountKey}
                  changes={{
                    new: priceAccount[priceAccountKey],
                  }}
                />
              ) : (
                JSON.stringify(changes.prev[index][priceAccountKey]) !==
                  JSON.stringify(priceAccount[priceAccountKey]) && (
                  <PublisherKeysChangesRows
                    key={priceAccountKey}
                    changes={{
                      prev: changes.prev[index][priceAccountKey],
                      new: priceAccount[priceAccountKey],
                    }}
                  />
                )
              )
            ) : (
              (addNewPriceFeed ||
                changes.prev[index][priceAccountKey] !==
                  priceAccount[priceAccountKey]) && (
                <tr key={priceAccountKey}>
                  <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                    {priceAccountKey
                      .split('_')
                      .map((word) => capitalizeFirstLetter(word))
                      .join(' ')}
                  </td>
                  <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                    {!addNewPriceFeed ? (
                      <>
                        <s>{changes.prev[index][priceAccountKey]}</s>
                        <br />
                      </>
                    ) : null}
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
    const addNewPriceFeed =
      changes.prev === undefined && changes.new !== undefined
    const publisherKeysToAdd = addNewPriceFeed
      ? changes.new
      : changes.new.filter(
          (newPublisher: string) => !changes.prev.includes(newPublisher)
        )
    const publisherKeysToRemove = addNewPriceFeed
      ? []
      : changes.prev.filter(
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

  const NewPriceFeedsRows = ({ priceFeedData }: { priceFeedData: any }) => {
    const key =
      priceFeedData.metadata.asset_type +
      '.' +
      priceFeedData.metadata.base +
      '/' +
      priceFeedData.metadata.quote_currency
    return (
      <>
        <MetadataChangesRows
          key={key + 'metadata'}
          changes={{ new: priceFeedData.metadata }}
        />
        <PriceAccountsChangesRows
          key={key + 'priceAccounts'}
          changes={{ new: priceFeedData.priceAccounts }}
        />
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
              const addNewPriceFeed =
                prev === undefined && newChanges !== undefined
              const diff = addNewPriceFeed
                ? []
                : Object.keys(prev).filter(
                    (k) =>
                      JSON.stringify(prev[k]) !== JSON.stringify(newChanges[k])
                  )
              return (
                <tbody key={key}>
                  <tr>
                    <td
                      className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                      colSpan={2}
                    >
                      {addNewPriceFeed ? 'Add New Price Feed' : key}
                    </td>
                  </tr>
                  {addNewPriceFeed ? (
                    <NewPriceFeedsRows key={key} priceFeedData={newChanges} />
                  ) : (
                    diff.map((k) =>
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
                    )
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
              onClick={handleSendProposalButtonClick}
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
