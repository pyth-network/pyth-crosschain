import { AnchorProvider, Idl, Program } from '@coral-xyz/anchor'
import { getPythProgramKeyForCluster } from '@pythnetwork/client'
import { PythOracle, pythOracleProgram } from '@pythnetwork/client/lib/anchor'
import { PublicKey } from '@solana/web3.js'
import messageBuffer from 'message_buffer/idl/message_buffer.json'
import { MessageBuffer } from 'message_buffer/idl/message_buffer'
import axios from 'axios'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getDownloadableConfig,
  getMultisigCluster,
  isMessageBufferAvailable,
  isRemoteCluster,
  mapKey,
  MESSAGE_BUFFER_PROGRAM_ID,
  PRICE_FEED_MULTISIG,
  ProgramType,
  validateUploadedConfig,
  generateInstructions,
  DownloadableConfig,
  DownloadableProduct,
  DownloadablePriceAccount,
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
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider'

interface PriceAccountMetadata extends DownloadablePriceAccount {
  [key: string]: string | string[] | number
}

interface PriceFeedData extends DownloadableProduct {
  key: string
}

interface MetadataChanges {
  prev?: Record<string, string | number | boolean>
  new: Record<string, string | number | boolean>
}

interface PriceAccountChanges {
  prev?: PriceAccountMetadata[]
  new: PriceAccountMetadata[]
}

interface PublisherChanges {
  prev?: string[]
  new: string[]
}

interface ProductChanges {
  prev?: Partial<DownloadableProduct>
  new: Partial<DownloadableProduct>
}

interface MetadataChangesRowsProps {
  changes: MetadataChanges
}

interface PriceAccountsChangesRowsProps {
  changes: PriceAccountChanges
}

interface PublisherKeysChangesRowsProps {
  changes: PublisherChanges
}

interface NewPriceFeedsRowsProps {
  priceFeedData: PriceFeedData
}

interface OldPriceFeedsRowsProps {
  priceFeedSymbol: string
}

interface ModalContentProps {
  changes: Record<string, ProductChanges>
  onSendProposal: () => void
  isSendProposalButtonLoading: boolean
}

const MetadataChangesRows: React.FC<MetadataChangesRowsProps> = ({
  changes,
}) => {
  const addPriceFeed = !changes.prev && changes.new
  return (
    <>
      {Object.entries(changes.new).map(
        ([metadataKey, newValue]) =>
          (addPriceFeed ||
            (changes.prev && changes.prev[metadataKey] !== newValue)) && (
            <tr key={metadataKey}>
              <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                {metadataKey
                  .split('_')
                  .map((word) => capitalizeFirstLetter(word))
                  .join(' ')}
              </td>

              <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                {!addPriceFeed && changes.prev ? (
                  <>
                    <s>{String(changes.prev[metadataKey])}</s>
                    <br />{' '}
                  </>
                ) : null}
                {String(newValue)}
              </td>
            </tr>
          )
      )}
    </>
  )
}

const PriceAccountsChangesRows: React.FC<PriceAccountsChangesRowsProps> = ({
  changes,
}) => {
  const addPriceFeed = !changes.prev && changes.new
  return (
    <>
      {changes.new.map((priceAccount: PriceAccountMetadata, index: number) =>
        Object.keys(priceAccount).map((priceAccountKey) =>
          priceAccountKey === 'publishers' ? (
            addPriceFeed ? (
              <PublisherKeysChangesRows
                key={priceAccountKey}
                changes={{
                  new: priceAccount[priceAccountKey] as string[],
                }}
              />
            ) : (
              changes.prev &&
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
              (changes.prev &&
                changes.prev[index][priceAccountKey] !==
                  priceAccount[priceAccountKey])) && (
              <tr key={priceAccountKey}>
                <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                  {priceAccountKey
                    .split('_')
                    .map((word) => capitalizeFirstLetter(word))
                    .join(' ')}
                </td>
                <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                  {!addPriceFeed && changes.prev ? (
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

const PublisherKeysChangesRows: React.FC<PublisherKeysChangesRowsProps> = ({
  changes,
}) => {
  const addPriceFeed = !changes.prev && changes.new
  const publisherKeysToAdd = addPriceFeed
    ? changes.new
    : changes.new.filter(
        (newPublisher) => !changes.prev?.includes(newPublisher)
      )
  const publisherKeysToRemove = addPriceFeed
    ? []
    : changes.prev?.filter(
        (prevPublisher) => !changes.new.includes(prevPublisher)
      ) || []
  return (
    <>
      {publisherKeysToRemove.length > 0 && (
        <tr>
          <td className="py-3 pl-6 pr-1 lg:pl-6">Remove Publisher(s)</td>
          <td className="py-3 pl-1 pr-8 lg:pl-6">
            {publisherKeysToRemove.map((publisherKey) => (
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
            {publisherKeysToAdd.map((publisherKey) => (
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

const NewPriceFeedsRows: React.FC<NewPriceFeedsRowsProps> = ({
  priceFeedData,
}) => {
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

const OldPriceFeedsRows: React.FC<OldPriceFeedsRowsProps> = ({
  priceFeedSymbol,
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

const hasKey = <T extends object>(obj: T, key: PropertyKey): key is keyof T => {
  return key in obj
}

const ModalContent: React.FC<ModalContentProps> = ({
  changes,
  onSendProposal,
  isSendProposalButtonLoading,
}) => {
  return (
    <>
      {Object.keys(changes).length > 0 ? (
        <table className="mb-10 w-full table-auto bg-darkGray text-left">
          {Object.entries(changes).map(([key, change]) => {
            const { prev, new: newChanges } = change
            const addPriceFeed = !prev && newChanges
            const deletePriceFeed = prev && !newChanges
            const diff =
              addPriceFeed || deletePriceFeed
                ? []
                : prev && newChanges
                  ? Object.keys(prev).filter(
                      (k) =>
                        hasKey(prev, k) &&
                        hasKey(newChanges, k) &&
                        JSON.stringify(prev[k]) !==
                          JSON.stringify(newChanges[k])
                    )
                  : []
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
                {addPriceFeed && newChanges ? (
                  <NewPriceFeedsRows
                    key={key}
                    priceFeedData={{ key, ...newChanges } as PriceFeedData}
                  />
                ) : deletePriceFeed ? (
                  <OldPriceFeedsRows key={key} priceFeedSymbol={key} />
                ) : (
                  prev &&
                  newChanges &&
                  diff.map((k) =>
                    k === 'metadata' ? (
                      <MetadataChangesRows
                        key={k}
                        changes={{
                          prev: prev.metadata as Record<
                            string,
                            string | number | boolean
                          >,
                          new: newChanges.metadata as Record<
                            string,
                            string | number | boolean
                          >,
                        }}
                      />
                    ) : k === 'priceAccounts' ? (
                      <PriceAccountsChangesRows
                        key={k}
                        changes={{
                          prev:
                            prev.priceAccounts?.map((account) => ({
                              ...account,
                            })) || [],
                          new:
                            newChanges.priceAccounts?.map((account) => ({
                              ...account,
                            })) || [],
                        }}
                      />
                    ) : null
                  )
                )}

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
            onClick={onSendProposal}
            disabled={isSendProposalButtonLoading}
          >
            {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
          </button>
        </>
      )}
    </>
  )
}

interface PythCoreProps {
  proposerServerUrl: string
}

const PythCore: React.FC<PythCoreProps> = ({ proposerServerUrl }) => {
  const [data, setData] = useState<DownloadableConfig>({})
  const [dataChanges, setDataChanges] =
    useState<Record<string, ProductChanges>>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const isRemote: boolean = isRemoteCluster(cluster)
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

  useEffect(() => {
    if (!dataIsLoading && rawConfig) {
      const downloadableConfig = getDownloadableConfig(rawConfig)
      setData(downloadableConfig)
    }
  }, [rawConfig, dataIsLoading, cluster])

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

  const handleUploadJsonButtonClick = () => {
    const uploadAnchor = document.createElement('input')
    uploadAnchor.setAttribute('type', 'file')
    uploadAnchor.setAttribute('accept', '.json')
    uploadAnchor.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          try {
            const uploadedConfig = JSON.parse(e.target.result as string)
            const validation = validateUploadedConfig[ProgramType.PYTH_CORE](
              data,
              uploadedConfig,
              cluster
            )

            if (!validation.isValid) {
              toast.error(validation.error || 'Invalid configuration')
              return
            }

            setDataChanges(validation.changes)
            openModal()
          } catch (error) {
            if (error instanceof Error) {
              toast.error(capitalizeFirstLetter(error.message))
            }
          }
        }
      }
      reader.readAsText(file)
    })
    document.body.appendChild(uploadAnchor) // required for firefox
    uploadAnchor.click()
    uploadAnchor.remove()
  }

  const handleSendProposalButtonClick = async () => {
    setIsSendProposalButtonLoading(true)
    if (pythProgramClient && dataChanges && !isMultisigLoading) {
      try {
        const multisigAuthority = readOnlySquads.getAuthorityPDA(
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
          1
        )
        const fundingAccount = isRemote
          ? mapKey(multisigAuthority)
          : multisigAuthority

        const instructions = await generateInstructions[ProgramType.PYTH_CORE](
          dataChanges,
          cluster,
          {
            fundingAccount,
            pythProgramClient,
            messageBufferClient,
            connection,
            rawConfig,
          }
        )

        const response = await axios.post(proposerServerUrl + '/api/propose', {
          instructions,
          cluster,
        })
        const { proposalPubkey } = response.data
        toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
        setIsSendProposalButtonLoading(false)
        closeModal()
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          toast.error(capitalizeFirstLetter(error.response.data))
        } else if (error instanceof Error) {
          toast.error(capitalizeFirstLetter(error.message))
        }
        setIsSendProposalButtonLoading(false)
      }
    }
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
        content={
          <ModalContent
            changes={dataChanges ? dataChanges : {}}
            onSendProposal={handleSendProposalButtonClick}
            isSendProposalButtonLoading={isSendProposalButtonLoading}
          />
        }
      />
      <div className="mb-4 flex">
        <ClusterSwitch />
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
  )
}

export default PythCore
