import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { AccountType, getPythProgramKeyForCluster } from '@pythnetwork/client'
import { PythOracle, pythOracleProgram } from '@pythnetwork/client/lib/anchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  findDetermisticAccountAddress,
  getMultisigCluster,
  isRemoteCluster,
  mapKey,
  PRICE_FEED_MULTISIG,
  proposeInstructions,
  WORMHOLE_ADDRESS,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import { usePythContext } from '../../contexts/PythContext'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'
import PermissionDepermissionKey from '../PermissionDepermissionKey'

const General = () => {
  const [data, setData] = useState<any>({})
  const [dataChanges, setDataChanges] = useState<Record<string, any>>()
  const [existingSymbols, setExistingSymbols] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const isRemote: boolean = isRemoteCluster(cluster) // Move to multisig context
  const multisigCluster: Cluster | 'localnet' = getMultisigCluster(cluster) // Move to multisig context
  const wormholeAddress = WORMHOLE_ADDRESS[multisigCluster] // Move to multisig context
  const { isLoading: isMultisigLoading, proposeSquads } = useMultisigContext()
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
            // remove duplicate publishers
            fileDataParsed[symbol].priceAccounts[0].publishers = [
              ...new Set(fileDataParsed[symbol].priceAccounts[0].publishers),
            ]
            if (!existingSymbols.has(symbol)) {
              // if symbol is not in existing symbols, create new entry
              changes[symbol] = { new: {} }
              changes[symbol].new = { ...fileDataParsed[symbol] }
              changes[symbol].new.metadata = {
                ...changes[symbol].new.metadata,
                symbol,
              }
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
          // check if any existing symbols are not in uploaded json
          Object.keys(data).forEach((symbol) => {
            if (!fileDataParsed[symbol]) {
              changes[symbol] = { prev: {} }
              changes[symbol].prev = { ...data[symbol] }
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
    let isValid = true
    // check if json keys "address" key is changed
    const jsonParsed = JSON.parse(json)
    Object.keys(jsonParsed).forEach((symbol) => {
      if (
        existingSymbols.has(symbol) &&
        jsonParsed[symbol].address &&
        jsonParsed[symbol].address !== data[symbol].address
      ) {
        toast.error(
          `Address field for product cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`
        )
        isValid = false
      }
    })

    // check if json keys "priceAccounts" key "address" key is changed
    Object.keys(jsonParsed).forEach((symbol) => {
      if (
        existingSymbols.has(symbol) &&
        jsonParsed[symbol].priceAccounts[0] &&
        data[symbol].priceAccounts[0] &&
        jsonParsed[symbol].priceAccounts[0].address &&
        jsonParsed[symbol].priceAccounts[0].address !==
          data[symbol].priceAccounts[0].address
      ) {
        toast.error(
          `Address field for priceAccounts cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`
        )
        isValid = false
      }
    })

    // check that no price account has more than 32 publishers
    Object.keys(jsonParsed).forEach((symbol) => {
      if (jsonParsed[symbol].priceAccounts[0].publishers.length > 32) {
        toast.error(`${symbol} has more than 32 publishers.`)
        isValid = false
      }
    })

    return isValid
  }

  const handleSendProposalButtonClick = async () => {
    if (
      pythProgramClient &&
      dataChanges &&
      !isMultisigLoading &&
      proposeSquads
    ) {
      const instructions: TransactionInstruction[] = []
      for (const symbol of Object.keys(dataChanges)) {
        const multisigAuthority = proposeSquads.getAuthorityPDA(
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
          1
        )
        const fundingAccount = isRemote
          ? mapKey(multisigAuthority)
          : multisigAuthority
        const { prev, new: newChanges } = dataChanges[symbol]
        // if prev is undefined, it means that the symbol is new
        if (!prev) {
          // deterministically generate product account key
          const productAccountKey: PublicKey = (
            await findDetermisticAccountAddress(
              AccountType.Product,
              symbol,
              cluster
            )
          )[0]
          // create add product account instruction
          instructions.push(
            await pythProgramClient.methods
              .addProduct({ ...newChanges.metadata })
              .accounts({
                fundingAccount,
                tailMappingAccount: rawConfig.mappingAccounts[0].address,
                productAccount: productAccountKey,
              })
              .instruction()
          )

          // deterministically generate price account key
          const priceAccountKey: PublicKey = (
            await findDetermisticAccountAddress(
              AccountType.Price,
              symbol,
              cluster
            )
          )[0]
          // create add price account instruction
          instructions.push(
            await pythProgramClient.methods
              .addPrice(newChanges.priceAccounts[0].expo, 1)
              .accounts({
                fundingAccount,
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
                    fundingAccount,
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
                  fundingAccount,
                })
                .instruction()
            )
          }
        } else if (!newChanges) {
          // if new is undefined, it means that the symbol is deleted
          // create delete price account instruction
          instructions.push(
            await pythProgramClient.methods
              .delPrice()
              .accounts({
                fundingAccount,
                productAccount: new PublicKey(prev.address),
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction()
          )
          // create delete product account instruction
          instructions.push(
            await pythProgramClient.methods
              .delProduct()
              .accounts({
                fundingAccount,
                mappingAccount: rawConfig.mappingAccounts[0].address,
                productAccount: new PublicKey(prev.address),
              })
              .instruction()
          )
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
                  fundingAccount,
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
                  fundingAccount,
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

          // add instructions to remove publishers
          publisherKeysToRemove.forEach((publisherKey: string) => {
            pythProgramClient.methods
              .delPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction()
              .then((instruction) => instructions.push(instruction))
          })

          // add instructions to add new publishers
          publisherKeysToAdd.forEach((publisherKey: string) => {
            pythProgramClient.methods
              .addPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction()
              .then((instruction) => instructions.push(instruction))
          })
        }
      }

      setIsSendProposalButtonLoading(true)
      try {
        const proposalPubkey = await proposeInstructions(
          proposeSquads,
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
          instructions,
          isRemote,
          wormholeAddress
        )
        toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
        setIsSendProposalButtonLoading(false)
        closeModal()
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
        setIsSendProposalButtonLoading(false)
      }
    }
  }

  const MetadataChangesRows = ({ changes }: { changes: any }) => {
    const addPriceFeed = changes.prev === undefined && changes.new !== undefined

    return (
      <>
        {Object.keys(changes.new).map(
          (metadataKey) =>
            (addPriceFeed ||
              changes.prev[metadataKey] !== changes.new[metadataKey]) && (
              <tr key={metadataKey}>
                <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                  {metadataKey
                    .split('_')
                    .map((word) => capitalizeFirstLetter(word))
                    .join(' ')}
                </td>

                <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                  {!addPriceFeed ? (
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
    const addPriceFeed = changes.prev === undefined && changes.new !== undefined
    return (
      <>
        {changes.new.map((priceAccount: any, index: number) =>
          Object.keys(priceAccount).map((priceAccountKey) =>
            priceAccountKey === 'publishers' ? (
              addPriceFeed ? (
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
              (addPriceFeed ||
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
                    {!addPriceFeed ? (
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
    const addPriceFeed = changes.prev === undefined && changes.new !== undefined
    const publisherKeysToAdd = addPriceFeed
      ? changes.new
      : changes.new.filter(
          (newPublisher: string) => !changes.prev.includes(newPublisher)
        )
    const publisherKeysToRemove = addPriceFeed
      ? []
      : changes.prev.filter(
          (prevPublisher: string) => !changes.new.includes(prevPublisher)
        )
    return (
      <>
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
      </>
    )
  }

  const NewPriceFeedsRows = ({ priceFeedData }: { priceFeedData: any }) => {
    return (
      <>
        <MetadataChangesRows
          key={priceFeedData.key + 'metadata'}
          changes={{ new: priceFeedData.metadata }}
        />
        <PriceAccountsChangesRows
          key={priceFeedData.key + 'priceAccounts'}
          changes={{ new: priceFeedData.priceAccounts }}
        />
      </>
    )
  }

  const OldPriceFeedsRows = ({ priceFeedData }: { priceFeedData: any }) => {
    return (
      <>
        <tr key={priceFeedData.metadata.symbol}>
          <td className="base16 py-4 pl-6 pr-2 lg:pl-6">Symbol</td>
          <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
            {priceFeedData.metadata.symbol}
          </td>
        </tr>
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
              const addPriceFeed =
                prev === undefined && newChanges !== undefined
              const deletePriceFeed =
                prev !== undefined && newChanges === undefined
              const diff =
                addPriceFeed || deletePriceFeed
                  ? []
                  : Object.keys(prev).filter(
                      (k) =>
                        JSON.stringify(prev[k]) !==
                        JSON.stringify(newChanges[k])
                    )
              return (
                <tbody key={key}>
                  <tr>
                    <td
                      className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                      colSpan={2}
                    >
                      {addPriceFeed
                        ? 'Add New Price Feed'
                        : deletePriceFeed
                        ? 'Delete Old Price Feed'
                        : key}
                    </td>
                  </tr>
                  {addPriceFeed ? (
                    <NewPriceFeedsRows key={key} priceFeedData={newChanges} />
                  ) : deletePriceFeed ? (
                    <OldPriceFeedsRows key={key} priceFeedData={prev} />
                  ) : (
                    diff.map((k) =>
                      k === 'metadata' ? (
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
          <button
            className="action-btn text-base"
            onClick={handleSendProposalButtonClick}
          >
            {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
          </button>
        ) : null}
      </>
    )
  }

  // create anchor wallet when connected
  useEffect(() => {
    if (connected && proposeSquads) {
      const provider = new AnchorProvider(
        connection,
        proposeSquads.wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )
    }
  }, [connection, connected, cluster, proposeSquads])

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
        <div className="relative mt-6 flex space-x-4">
          <PermissionDepermissionKey
            isPermission={true}
            pythProgramClient={pythProgramClient}
            squads={proposeSquads}
          />
          <PermissionDepermissionKey
            isPermission={false}
            pythProgramClient={pythProgramClient}
            squads={proposeSquads}
          />
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
