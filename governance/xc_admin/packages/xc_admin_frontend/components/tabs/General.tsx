import { AnchorProvider, Idl, Program } from '@coral-xyz/anchor'
import { AccountType, getPythProgramKeyForCluster } from '@pythnetwork/client'
import { PythOracle, pythOracleProgram } from '@pythnetwork/client/lib/anchor'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import messageBuffer from 'message_buffer/idl/message_buffer.json'
import { MessageBuffer } from 'message_buffer/idl/message_buffer'
import axios from 'axios'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  findDetermisticAccountAddress,
  getMultisigCluster,
  getPythOracleMessageBufferCpiAuth,
  isMessageBufferAvailable,
  isRemoteCluster,
  mapKey,
  MESSAGE_BUFFER_PROGRAM_ID,
  MESSAGE_BUFFER_BUFFER_SIZE,
  PRICE_FEED_MULTISIG,
  PRICE_FEED_OPS_KEY,
  getMessageBufferAddressForPrice,
  getMaximumNumberOfPublishers,
  isPriceStoreInitialized,
  isPriceStorePublisherInitialized,
  createDetermisticPriceStoreInitializePublisherInstruction,
} from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import { usePythContext } from '../../contexts/PythContext'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'
import PermissionDepermissionKey from '../PermissionDepermissionKey'
import { PriceRawConfig } from '../../hooks/usePyth'
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider'

// These are the values such that a transaction adding a remote addProduct or updProduct instruction to a proposal are exactly 1232 bytes
const MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA = 369
const MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA = 403 // upd product has one account less

const checkSizeOfProductInstruction = (
  instruction: TransactionInstruction,
  maxSize: number,
  symbol: string
) => {
  const size = instruction.data.length
  if (size > maxSize) {
    throw new Error(
      `A symbol metadata is too big to be sent in a transaction (${size} > ${maxSize} bytes). Please reduce the size of the symbol metadata for ${symbol}.`
    )
  }
}

const General = ({ proposerServerUrl }: { proposerServerUrl: string }) => {
  const [data, setData] = useState<any>({}) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [dataChanges, setDataChanges] = useState<Record<string, any>>() // eslint-disable-line @typescript-eslint/no-explicit-any
  const [existingSymbols, setExistingSymbols] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const isRemote: boolean = isRemoteCluster(cluster) // Move to multisig context
  const { isLoading: isMultisigLoading, readOnlySquads } = useMultisigContext()
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const [pythProgramClient, setPythProgramClient] =
    useState<Program<PythOracle>>()

  const [messageBufferClient, setMessageBufferClient] =
    useState<Program<MessageBuffer>>()

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortData = (data: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedData: any = {}
    Object.keys(data)
      .sort()
      .forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                  priceAccount1: any, // eslint-disable-line @typescript-eslint/no-explicit-any
                  priceAccount2: any // eslint-disable-line @typescript-eslint/no-explicit-any
                ) => priceAccount1.address.localeCompare(priceAccount2.address)
              )
              // sort price accounts keys
              sortedInnerData[innerKey] = sortedInnerData[innerKey].map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (priceAccount: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const symbolToData: any = {} // eslint-disable-line @typescript-eslint/no-explicit-any
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
            priceAccounts: product.priceAccounts.map((p: PriceRawConfig) => {
              return {
                address: p.address.toBase58(),
                publishers: p.publishers
                  .map((p) => p.toBase58())
                  .slice(0, getMaximumNumberOfPublishers(cluster)),
                expo: p.expo,
                minPub: p.minPub,
                maxLatency: p.maxLatency,
              }
            }),
          }
          // this field is immutable and should not be updated
          delete symbolToData[product.metadata.symbol].metadata.price_account
        })
      setExistingSymbols(new Set(Object.keys(symbolToData)))
      setData(sortDataMemo(symbolToData))
    }
  }, [rawConfig, dataIsLoading, sortDataMemo, cluster])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortObjectByKeys = (obj: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const file = (e.target as HTMLInputElement).files![0]
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target) {
          const fileData = e.target.result
          if (!isValidJson(fileData as string)) return
          const fileDataParsed = sortData(JSON.parse(fileData as string))
          const changes: Record<string, any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
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
                symbol,
                ...changes[symbol].new.metadata,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // check that no price account has more than the maximum number of publishers
    Object.keys(jsonParsed).forEach((symbol) => {
      const maximumNumberOfPublishers = getMaximumNumberOfPublishers(cluster)
      if (
        jsonParsed[symbol].priceAccounts[0].publishers.length >
        maximumNumberOfPublishers
      ) {
        toast.error(
          `${symbol} has more than ${maximumNumberOfPublishers} publishers.`
        )
        isValid = false
      }
    })

    return isValid
  }

  const handleSendProposalButtonClick = () => {
    const handleSendProposalButtonClickAsync = async () => {
      setIsSendProposalButtonLoading(true)
      if (pythProgramClient && dataChanges && !isMultisigLoading) {
        const instructions: TransactionInstruction[] = []
        const publisherInPriceStoreInitializationsVerified: PublicKey[] = []

        for (const symbol of Object.keys(dataChanges)) {
          const multisigAuthority = readOnlySquads.getAuthorityPDA(
            PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
            1
          )
          const fundingAccount = isRemote
            ? mapKey(multisigAuthority)
            : multisigAuthority

          const initPublisherInPriceStore = async (publisherKey: PublicKey) => {
            // Ignore this step if Price Store is not initialized (or not deployed)
            if (!connection || !(await isPriceStoreInitialized(connection))) {
              return
            }

            if (
              publisherInPriceStoreInitializationsVerified.every(
                (el) => !el.equals(publisherKey)
              )
            ) {
              if (
                !connection ||
                !(await isPriceStorePublisherInitialized(
                  connection,
                  publisherKey
                ))
              ) {
                instructions.push(
                  await createDetermisticPriceStoreInitializePublisherInstruction(
                    fundingAccount,
                    publisherKey
                  )
                )
              }
              publisherInPriceStoreInitializationsVerified.push(publisherKey)
            }
          }
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
            const instruction = await pythProgramClient.methods
              .addProduct({ ...newChanges.metadata })
              .accounts({
                fundingAccount,
                tailMappingAccount: rawConfig.mappingAccounts[0].address,
                productAccount: productAccountKey,
              })
              .instruction()
            checkSizeOfProductInstruction(
              instruction,
              MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA,
              symbol
            )
            instructions.push(instruction)

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

            if (isMessageBufferAvailable(cluster) && messageBufferClient) {
              // create create buffer instruction for the price account
              instructions.push(
                await messageBufferClient.methods
                  .createBuffer(
                    getPythOracleMessageBufferCpiAuth(cluster),
                    priceAccountKey,
                    MESSAGE_BUFFER_BUFFER_SIZE
                  )
                  .accounts({
                    admin: fundingAccount,
                    payer: PRICE_FEED_OPS_KEY,
                  })
                  .remainingAccounts([
                    {
                      pubkey: getMessageBufferAddressForPrice(
                        cluster,
                        priceAccountKey
                      ),
                      isSigner: false,
                      isWritable: true,
                    },
                  ])
                  .instruction()
              )
            }

            // create add publisher instruction if there are any publishers
            for (const publisherKey of newChanges.priceAccounts[0].publishers) {
              const publisherPubKey = new PublicKey(publisherKey)
              instructions.push(
                await pythProgramClient.methods
                  .addPublisher(publisherPubKey)
                  .accounts({
                    fundingAccount,
                    priceAccount: priceAccountKey,
                  })
                  .instruction()
              )
              await initPublisherInPriceStore(publisherPubKey)
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

            // If maxLatency is set and is not 0, create update maxLatency instruction
            if (
              newChanges.priceAccounts[0].maxLatency !== undefined &&
              newChanges.priceAccounts[0].maxLatency !== 0
            ) {
              instructions.push(
                await pythProgramClient.methods
                  .setMaxLatency(
                    newChanges.priceAccounts[0].maxLatency,
                    [0, 0, 0]
                  )
                  .accounts({
                    priceAccount: priceAccountKey,
                    fundingAccount,
                  })
                  .instruction()
              )
            }
          } else if (!newChanges) {
            const priceAccount = new PublicKey(prev.priceAccounts[0].address)

            // if new is undefined, it means that the symbol is deleted
            // create delete price account instruction
            instructions.push(
              await pythProgramClient.methods
                .delPrice()
                .accounts({
                  fundingAccount,
                  productAccount: new PublicKey(prev.address),
                  priceAccount,
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

            if (isMessageBufferAvailable(cluster) && messageBufferClient) {
              // create delete buffer instruction for the price buffer
              instructions.push(
                await messageBufferClient.methods
                  .deleteBuffer(
                    getPythOracleMessageBufferCpiAuth(cluster),
                    priceAccount
                  )
                  .accounts({
                    admin: fundingAccount,
                    payer: PRICE_FEED_OPS_KEY,
                    messageBuffer: getMessageBufferAddressForPrice(
                      cluster,
                      priceAccount
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
              const instruction = await pythProgramClient.methods
                .updProduct({ symbol, ...newChanges.metadata }) // If there's a symbol in newChanges.metadata, it will overwrite the current symbol
                .accounts({
                  fundingAccount,
                  productAccount: new PublicKey(prev.address),
                })
                .instruction()
              checkSizeOfProductInstruction(
                instruction,
                MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA,
                symbol
              )
              instructions.push(instruction)
            }

            if (
              JSON.stringify(prev.priceAccounts[0].expo) !==
              JSON.stringify(newChanges.priceAccounts[0].expo)
            ) {
              // create update exponent instruction
              instructions.push(
                await pythProgramClient.methods
                  .setExponent(newChanges.priceAccounts[0].expo, 1)
                  .accounts({
                    fundingAccount,
                    priceAccount: new PublicKey(prev.priceAccounts[0].address),
                  })
                  .instruction()
              )
            }

            // check if maxLatency has changed
            if (
              prev.priceAccounts[0].maxLatency !==
              newChanges.priceAccounts[0].maxLatency
            ) {
              // create update product account instruction
              instructions.push(
                await pythProgramClient.methods
                  .setMaxLatency(
                    newChanges.priceAccounts[0].maxLatency,
                    [0, 0, 0]
                  )
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
            const publisherKeysToRemove =
              prev.priceAccounts[0].publishers.filter(
                (prevPublisher: string) =>
                  !newChanges.priceAccounts[0].publishers.includes(
                    prevPublisher
                  )
              )

            // add instructions to remove publishers

            for (const publisherKey of publisherKeysToRemove) {
              instructions.push(
                await pythProgramClient.methods
                  .delPublisher(new PublicKey(publisherKey))
                  .accounts({
                    fundingAccount,
                    priceAccount: new PublicKey(prev.priceAccounts[0].address),
                  })
                  .instruction()
              )
            }

            // add instructions to add new publishers
            for (const publisherKey of publisherKeysToAdd) {
              const publisherPubKey = new PublicKey(publisherKey)
              instructions.push(
                await pythProgramClient.methods
                  .addPublisher(publisherPubKey)
                  .accounts({
                    fundingAccount,
                    priceAccount: new PublicKey(prev.priceAccounts[0].address),
                  })
                  .instruction()
              )
              await initPublisherInPriceStore(publisherPubKey)
            }

            // check if minPub has changed
            if (
              prev.priceAccounts[0].minPub !==
              newChanges.priceAccounts[0].minPub
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
          }
        }

        const response = await axios.post(proposerServerUrl + '/api/propose', {
          instructions,
          cluster,
        })
        const { proposalPubkey } = response.data
        toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
        setIsSendProposalButtonLoading(false)
        closeModal()
      }
    }

    handleSendProposalButtonClickAsync().catch((error) => {
      if (error.response) {
        toast.error(capitalizeFirstLetter(error.response.data))
      } else {
        toast.error(capitalizeFirstLetter(error.message))
      }
      setIsSendProposalButtonLoading(false)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PriceAccountsChangesRows = ({ changes }: { changes: any }) => {
    const addPriceFeed = changes.prev === undefined && changes.new !== undefined
    return (
      <>
        {changes.new.map(
          (
            priceAccount: any, // eslint-disable-line @typescript-eslint/no-explicit-any
            index: number
          ) =>
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const OldPriceFeedsRows = ({
    priceFeedSymbol,
  }: {
    priceFeedSymbol: string
  }) => {
    return (
      <>
        <tr key={priceFeedSymbol}>
          <td className="base16 py-4 pl-6 pr-2 lg:pl-6">Symbol</td>
          <td className="base16 py-4 pl-1 pr-2 lg:pl-6">{priceFeedSymbol}</td>
        </tr>
      </>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    <OldPriceFeedsRows key={key} priceFeedSymbol={key} />
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
        {Object.keys(changes).length > 0 && (
          <>
            <button
              className="action-btn text-base"
              onClick={handleSendProposalButtonClick}
              disabled={isSendProposalButtonLoading}
            >
              {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
            </button>
          </>
        )}
      </>
    )
  }

  useEffect(() => {
    if (connection) {
      const provider = new AnchorProvider(
        connection,
        readOnlySquads.wallet as Wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )

      if (isMessageBufferAvailable(cluster)) {
        setMessageBufferClient(
          new Program(
            messageBuffer as Idl,
            new PublicKey(MESSAGE_BUFFER_PROGRAM_ID),
            provider
          ) as unknown as Program<MessageBuffer>
        )
      }
    }
  }, [connection, cluster, readOnlySquads])

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
            readOnlySquads={readOnlySquads}
            proposerServerUrl={proposerServerUrl}
          />
          <PermissionDepermissionKey
            isPermission={false}
            pythProgramClient={pythProgramClient}
            readOnlySquads={readOnlySquads}
            proposerServerUrl={proposerServerUrl}
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
