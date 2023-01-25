import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { Fragment, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { proposeInstructions } from 'xc-admin-common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import {
  getMultisigCluster,
  SECURITY_MULTISIG,
  useMultisig,
} from '../../hooks/useMultisig'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'

interface PriceAccountToPublisherKeys {
  [key: string]: PublicKey[]
}

interface PublishersInfo {
  prev: string[]
  new: string[]
}

const AddRemovePublishers = () => {
  const [data, setData] = useState<PriceAccountToPublisherKeys>({})
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
    if (!dataIsLoading && rawConfig) {
      const priceAccountToPublishers: PriceAccountToPublisherKeys = {}
      rawConfig.mappingAccounts.map((mappingAccount) => {
        mappingAccount.products.map((product) => {
          const priceAccount = product.priceAccounts.find(
            (priceAccount) =>
              priceAccount.address.toBase58() === product.metadata.price_account
          )
          if (priceAccount) {
            priceAccountToPublishers[priceAccount.address.toBase58()] =
              priceAccount.publishers
          }
        })
      })
      setData(priceAccountToPublishers)
    }
  }, [rawConfig, dataIsLoading])

  // function to download json file
  const handleDownloadJsonButtonClick = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'data.json')
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
          const fileDataParsed = JSON.parse(fileData as string)
          const changes: Record<string, PublishersInfo> = {}
          Object.keys(fileDataParsed).forEach((priceAccount) => {
            if (
              JSON.stringify(data[priceAccount]) !==
              JSON.stringify(fileDataParsed[priceAccount])
            ) {
              changes[priceAccount] = { prev: [], new: [] }
              changes[priceAccount].prev = data[priceAccount].map(
                (p: PublicKey) => p.toBase58()
              )
              changes[priceAccount].new = fileDataParsed[priceAccount]
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
    // check if json keys are valid existing price accounts
    const jsonParsed = JSON.parse(json)
    const jsonPriceAccounts = Object.keys(jsonParsed)
    const existingPriceAccounts = Object.keys(data)
    // check that jsonPriceAccounts is equal to existingPriceAccounts no matter the order
    if (
      JSON.stringify(jsonPriceAccounts.sort()) !==
      JSON.stringify(existingPriceAccounts.sort())
    ) {
      toast.error(
        'Price accounts in json file do not match existing price accounts!'
      )
      return false
    }
    return true
  }

  const handleSendProposalButtonClick = async () => {
    if (pythProgramClient && publisherChanges) {
      const instructions: TransactionInstruction[] = []
      Object.keys(publisherChanges).forEach((priceAccountKey) => {
        const { prev, new: newPublisherKeys } =
          publisherChanges[priceAccountKey]
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
              priceAccount: PublicKey.unique(),
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
              priceAccount: PublicKey.unique(),
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
        {changes ? (
          Object.keys(changes).map((key) => {
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
                <table className="mb-4 w-full table-auto bg-darkGray text-left">
                  <thead>
                    <tr>
                      <th className="base16 py-8 pl-6 pr-2 font-semibold lg:pl-14">
                        Description
                      </th>
                      <th className="base16 py-8 pl-1 pr-2 font-semibold lg:pl-14">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <Fragment key={key}>
                      <tr>
                        <td className="py-3 pl-6 pr-1 lg:pl-14">
                          Price Account
                        </td>
                        <td className="py-3 pl-1 pr-8 lg:pl-14">{key}</td>
                      </tr>
                      {publisherKeysToAdd.length > 0 && (
                        <tr>
                          <td className="py-3 pl-6 pr-1 lg:pl-14">
                            Add Publisher(s)
                          </td>
                          <td className="py-3 pl-1 pr-8 lg:pl-14">
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
                          <td className="py-3 pl-6 pr-1 lg:pl-14">
                            Remove Publisher(s)
                          </td>
                          <td className="py-3 pl-1 pr-8 lg:pl-14">
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
                </table>
              )
            )
          })
        ) : (
          <p className="mb-8 leading-6">No proposed changes.</p>
        )}
        {changes ? (
          <button
            className="action-btn text-base"
            onClick={handleSendProposalButtonClick}
            disabled={!changes}
          >
            {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
          </button>
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
