import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { Fragment, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getMultisigCluster, proposeInstructions } from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import { SECURITY_MULTISIG, useMultisig } from '../../hooks/useMultisig'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'

interface SymbolToPublisherKeys {
  [key: string]: PublicKey[]
}

interface PublishersInfo {
  prev: string[]
  new: string[]
}

let symbolToPriceAccountKeyMapping: Record<string, string> = {}

const AddRemovePublishers = () => {
  const [data, setData] = useState<SymbolToPublisherKeys>({})
  const [publisherChanges, setPublisherChanges] =
    useState<Record<string, PublishersInfo>>()
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

  useEffect(() => {
    if (!dataIsLoading && rawConfig && rawConfig.mappingAccounts.length > 0) {
      let symbolToPublisherKeysMapping: SymbolToPublisherKeys = {}
      rawConfig.mappingAccounts.map((mappingAccount) => {
        mappingAccount.products.map((product) => {
          const priceAccount = product.priceAccounts.find(
            (priceAccount) =>
              priceAccount.address.toBase58() === product.metadata.price_account
          )
          if (priceAccount) {
            symbolToPublisherKeysMapping[product.metadata.symbol] =
              priceAccount.publishers
            symbolToPriceAccountKeyMapping[product.metadata.symbol] =
              priceAccount.address.toBase58()
          }
        })
      })
      symbolToPublisherKeysMapping = sortData(symbolToPublisherKeysMapping)
      setData(symbolToPublisherKeysMapping)
    }
  }, [rawConfig, dataIsLoading])

  const sortData = (data: SymbolToPublisherKeys) => {
    let sortedSymbolToPublisherKeysMapping: SymbolToPublisherKeys = {}
    // sort symbolToPublisherKeysMapping by symbol
    sortedSymbolToPublisherKeysMapping = JSON.parse(
      JSON.stringify(data, Object.keys(data).sort())
    )
    // sort symbolToPublisherKeysMapping by publisher keys
    Object.keys(sortedSymbolToPublisherKeysMapping).forEach((key) => {
      // sort publisher keys and make them each of type PublicKey because JSON.stringify makes them of type string
      sortedSymbolToPublisherKeysMapping[key] =
        sortedSymbolToPublisherKeysMapping[key]
          .sort()
          .map((publisherKey) => new PublicKey(publisherKey))
    })
    return sortedSymbolToPublisherKeysMapping
  }

  // function to download json file
  const handleDownloadJsonButtonClick = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'publishers.json')
    document.body.appendChild(downloadAnchor) // required for firefox
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // function to upload json file and update publisherChanges state
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
          const changes: Record<string, PublishersInfo> = {}
          Object.keys(fileDataParsed).forEach((symbol) => {
            if (
              JSON.stringify(data[symbol]) !==
              JSON.stringify(fileDataParsed[symbol])
            ) {
              changes[symbol] = { prev: [], new: [] }
              changes[symbol].prev = data[symbol].map((p: PublicKey) =>
                p.toBase58()
              )
              changes[symbol].new = fileDataParsed[symbol].map((p: PublicKey) =>
                p.toBase58()
              )
            }
          })
          setPublisherChanges(changes)
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

  const handleSendProposalButtonClick = async () => {
    if (pythProgramClient && publisherChanges) {
      const instructions: TransactionInstruction[] = []
      Object.keys(publisherChanges).forEach((symbol) => {
        const { prev, new: newPublisherKeys } = publisherChanges[symbol]
        // prev and new are arrays of publisher pubkeys
        // check if there are any new publishers by comparing prev and new
        const publisherKeysToAdd = newPublisherKeys.filter(
          (newPublisher) => !prev.includes(newPublisher)
        )
        // check if there are any publishers to remove by comparing prev and new
        const publisherKeysToRemove = prev.filter(
          (prevPublisher) => !newPublisherKeys.includes(prevPublisher)
        )
        // add instructions to add new publishers
        publisherKeysToAdd.forEach((publisherKey) => {
          pythProgramClient.methods
            .addPublisher(new PublicKey(publisherKey))
            .accounts({
              fundingAccount: squads?.getAuthorityPDA(
                SECURITY_MULTISIG[getMultisigCluster(cluster)],
                1
              ),
              priceAccount: new PublicKey(
                symbolToPriceAccountKeyMapping[symbol]
              ),
            })
            .instruction()
            .then((instruction) => instructions.push(instruction))
        })
        // add instructions to remove publishers
        publisherKeysToRemove.forEach((publisherKey) => {
          pythProgramClient.methods
            .delPublisher(new PublicKey(publisherKey))
            .accounts({
              fundingAccount: squads?.getAuthorityPDA(
                SECURITY_MULTISIG[getMultisigCluster(cluster)],
                1
              ),
              priceAccount: new PublicKey(
                symbolToPriceAccountKeyMapping[symbol]
              ),
            })
            .instruction()
            .then((instruction) => instructions.push(instruction))
        })
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

  const ModalContent = ({ changes }: { changes: any }) => {
    return (
      <>
        {Object.keys(changes).length > 0 ? (
          <table className="mb-10 w-full table-auto bg-darkGray text-left">
            <thead>
              <tr>
                <th className="base16 py-8 pl-6 pr-2 font-semibold lg:pl-6">
                  Description
                </th>
                <th className="base16 py-8 pl-1 pr-2 font-semibold lg:pl-6">
                  ID
                </th>
              </tr>
            </thead>
            {Object.keys(changes).map((key) => {
              const publisherKeysToAdd = changes[key].new.filter(
                (newPublisher: string) =>
                  !changes[key].prev.includes(newPublisher)
              )
              const publisherKeysToRemove = changes[key].prev.filter(
                (prevPublisher: string) =>
                  !changes[key].new.includes(prevPublisher)
              )
              return (
                changes[key].prev !== changes[key].new && (
                  <tbody>
                    <Fragment key={key}>
                      <tr>
                        <td className="py-3 pl-6 pr-1 lg:pl-6">Product</td>
                        <td className="py-3 pl-1 pr-8 lg:pl-6">{key}</td>
                      </tr>
                      {publisherKeysToAdd.length > 0 && (
                        <tr>
                          <td className="py-3 pl-6 pr-1 lg:pl-6">
                            Add Publisher(s)
                          </td>
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
                          <td className="py-3 pl-6 pr-1 lg:pl-6">
                            Remove Publisher(s)
                          </td>
                          <td className="py-3 pl-1 pr-8 lg:pl-6">
                            {publisherKeysToRemove.map(
                              (publisherKey: string) => (
                                <span key={publisherKey} className="block">
                                  {publisherKey}
                                </span>
                              )
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  </tbody>
                )
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
        content={<ModalContent changes={publisherChanges} />}
      />
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Add/Remove Publishers</h1>
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

export default AddRemovePublishers
