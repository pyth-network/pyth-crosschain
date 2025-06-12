import React, { useState, useContext } from 'react'
import { usePythContext } from '../../contexts/PythContext'
import { ClusterContext } from '../../contexts/ClusterContext'
import Modal from '../common/Modal'
import {
  validateUploadedConfig,
  ProgramType,
  mapKey,
  PRICE_FEED_MULTISIG,
  getMultisigCluster,
  isRemoteCluster,
} from '@pythnetwork/xc-admin-common'
import toast from 'react-hot-toast'
import Loadbar from '../loaders/Loadbar'
import Spinner from '../common/Spinner'
import {
  LazerFeed,
  LazerPublisher,
  LazerConfigChanges,
} from '@pythnetwork/xc-admin-common/src/programs/types'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import { generateInstructions } from '@pythnetwork/xc-admin-common/lib/programs/lazer/lazer_functions'
import { useMultisigContext } from '../../contexts/MultisigContext'

interface PythLazerProps {
  proposerServerUrl: string
}

interface ShardChanges {
  prev?: {
    shardId: number
    shardName: string
    minRate: string
  }
  new: {
    shardId: number
    shardName: string
    minRate: string
  }
}

interface FeedChanges {
  prev?: LazerFeed
  new?: LazerFeed
}

interface PublisherChanges {
  prev?: LazerPublisher
  new?: LazerPublisher
}

interface ShardChangesRowsProps {
  changes: ShardChanges
}

interface FeedChangesRowsProps {
  changes: FeedChanges
  feedId: string
}

interface PublisherChangesRowsProps {
  changes: PublisherChanges
  publisherId: string
}

interface ModalContentProps {
  changes: LazerConfigChanges
  onSendProposal: () => void
  isSendProposalButtonLoading: boolean
}

const ShardChangesRows: React.FC<ShardChangesRowsProps> = ({ changes }) => {
  const isNewShard = !changes.prev && changes.new

  return (
    <>
      {Object.entries(changes.new).map(
        ([key, newValue]) =>
          (isNewShard ||
            (changes.prev &&
              changes.prev[key as keyof typeof changes.prev] !== newValue)) && (
            <tr key={key}>
              <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                {key
                  .split(/(?=[A-Z])/)
                  .join(' ')
                  .split('_')
                  .map((word) => capitalizeFirstLetter(word))
                  .join(' ')}
              </td>
              <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                {!isNewShard && changes.prev ? (
                  <>
                    <s>
                      {String(changes.prev[key as keyof typeof changes.prev])}
                    </s>
                    <br />
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

const FeedChangesRows: React.FC<FeedChangesRowsProps> = ({
  changes,
  feedId,
}) => {
  const isNewFeed = !changes.prev && changes.new
  const isDeletedFeed = changes.prev && !changes.new

  if (isDeletedFeed) {
    return (
      <tr>
        <td className="base16 py-4 pl-6 pr-2 lg:pl-6">Feed ID</td>
        <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
          {feedId.replace('feed_', '')}
        </td>
      </tr>
    )
  }

  if (!changes.new) return null

  const renderMetadataChanges = () => {
    if (!changes.new?.metadata) return null

    return Object.entries(changes.new.metadata).map(([key, newValue]) => {
      const prevValue =
        changes.prev?.metadata?.[key as keyof typeof changes.prev.metadata]
      const hasChanged = isNewFeed || prevValue !== newValue

      if (!hasChanged) return null

      return (
        <tr key={key}>
          <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
            {key
              .split(/(?=[A-Z])/)
              .join(' ')
              .split('_')
              .map((word) => capitalizeFirstLetter(word))
              .join(' ')}
          </td>
          <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
            {!isNewFeed && prevValue !== undefined ? (
              <>
                <s>{String(prevValue)}</s>
                <br />
              </>
            ) : null}
            {String(newValue)}
          </td>
        </tr>
      )
    })
  }

  const renderPendingActivationChanges = () => {
    if (
      changes.new?.pendingActivation !== undefined ||
      changes.prev?.pendingActivation !== undefined
    ) {
      const hasChanged =
        isNewFeed ||
        changes.prev?.pendingActivation !== changes.new?.pendingActivation

      if (hasChanged) {
        return (
          <tr key="pendingActivation">
            <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
              Pending Activation
            </td>
            <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
              {!isNewFeed && changes.prev?.pendingActivation ? (
                <>
                  <s>{changes.prev.pendingActivation}</s>
                  <br />
                </>
              ) : null}
              {changes.new?.pendingActivation || 'None'}
            </td>
          </tr>
        )
      }
    }
    return null
  }

  return (
    <>
      {renderMetadataChanges()}
      {renderPendingActivationChanges()}
    </>
  )
}

const PublisherChangesRows: React.FC<PublisherChangesRowsProps> = ({
  changes,
  publisherId,
}) => {
  const isNewPublisher = !changes.prev && changes.new
  const isDeletedPublisher = changes.prev && !changes.new

  if (isDeletedPublisher) {
    return (
      <tr>
        <td className="base16 py-4 pl-6 pr-2 lg:pl-6">Publisher ID</td>
        <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
          {publisherId.replace('publisher_', '')}
        </td>
      </tr>
    )
  }

  if (!changes.new) return null

  return (
    <>
      {Object.entries(changes.new).map(([key, newValue]) => {
        const prevValue = changes.prev?.[key as keyof LazerPublisher]
        const hasChanged =
          isNewPublisher ||
          JSON.stringify(prevValue) !== JSON.stringify(newValue)

        if (!hasChanged) return null

        return (
          <tr key={key}>
            <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
              {key
                .split(/(?=[A-Z])/)
                .join(' ')
                .split('_')
                .map((word) => capitalizeFirstLetter(word))
                .join(' ')}
            </td>
            <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
              {!isNewPublisher && prevValue !== undefined ? (
                <>
                  <s>
                    {Array.isArray(prevValue)
                      ? prevValue.join(', ')
                      : String(prevValue)}
                  </s>
                  <br />
                </>
              ) : null}
              {Array.isArray(newValue) ? newValue.join(', ') : String(newValue)}
            </td>
          </tr>
        )
      })}
    </>
  )
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
            const isAddition = !prev && newChanges
            const isDeletion = prev && !newChanges

            let title = key
            if (key === 'shard') {
              title = isAddition
                ? 'Add New Shard'
                : isDeletion
                  ? 'Delete Shard'
                  : 'Shard Configuration'
            } else if (key.startsWith('feed_')) {
              const feedId = key.replace('feed_', '')
              title = isAddition
                ? `Add New Feed (ID: ${feedId})`
                : isDeletion
                  ? `Delete Feed (ID: ${feedId})`
                  : `Feed ${feedId}`
            } else if (key.startsWith('publisher_')) {
              const publisherId = key.replace('publisher_', '')
              title = isAddition
                ? `Add New Publisher (ID: ${publisherId})`
                : isDeletion
                  ? `Delete Publisher (ID: ${publisherId})`
                  : `Publisher ${publisherId}`
            }

            return (
              <tbody key={key}>
                <tr>
                  <td
                    className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                    colSpan={2}
                  >
                    {title}
                  </td>
                </tr>

                {key === 'shard' && newChanges ? (
                  <ShardChangesRows
                    changes={{
                      prev: prev as ShardChanges['prev'],
                      new: newChanges as ShardChanges['new'],
                    }}
                  />
                ) : key.startsWith('feed_') ? (
                  <FeedChangesRows
                    feedId={key}
                    changes={{
                      prev: prev as LazerFeed,
                      new: newChanges as LazerFeed,
                    }}
                  />
                ) : key.startsWith('publisher_') ? (
                  <PublisherChangesRows
                    publisherId={key}
                    changes={{
                      prev: prev as LazerPublisher,
                      new: newChanges as LazerPublisher,
                    }}
                  />
                ) : null}

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
        <button
          className="action-btn text-base"
          onClick={onSendProposal}
          disabled={isSendProposalButtonLoading}
        >
          {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
        </button>
      )}
    </>
  )
}

const PythLazer = ({
  proposerServerUrl: _proposerServerUrl,
}: PythLazerProps) => {
  const { dataIsLoading, lazerState } = usePythContext()
  const { cluster } = useContext(ClusterContext)

  const [dataChanges, setDataChanges] = useState<LazerConfigChanges>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { isLoading: isMultisigLoading, readOnlySquads } = useMultisigContext()
  const isRemote: boolean = isRemoteCluster(cluster)

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleDownloadJsonButtonClick = () => {
    if (!lazerState) return

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(lazerState, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `lazer_config.json`)
    document.body.appendChild(downloadAnchor) // required for firefox
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleUploadJsonButtonClick = () => {
    if (!lazerState) {
      toast.error('Lazer state not available')
      return
    }

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
            const validation = validateUploadedConfig[ProgramType.PYTH_LAZER](
              lazerState,
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
    if (dataChanges && !isMultisigLoading) {
      try {
        const multisigAuthority = readOnlySquads.getAuthorityPDA(
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
          1
        )
        const fundingAccount = isRemote
          ? mapKey(multisigAuthority)
          : multisigAuthority
        // Generate the instructions for the proposal
        const instructions = await generateInstructions(
          dataChanges as LazerConfigChanges,
          {
            fundingAccount,
          },
          'lazer_production'
        )

        console.log('Generated instructions:', instructions)

        // In a real implementation, this would send the proposal to the server
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Mock delay

        // Close the modal and show success notification
        setIsModalOpen(false)
        toast.success('Proposal sent successfully!')
      } catch (error) {
        if (error instanceof Error) {
          toast.error(capitalizeFirstLetter(error.message))
        }
      } finally {
        setIsSendProposalButtonLoading(false)
      }
    }
  }

  return (
    <div className="relative">
      <Modal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        closeModal={closeModal}
        content={
          <ModalContent
            changes={dataChanges || {}}
            onSendProposal={handleSendProposalButtonClick}
            isSendProposalButtonLoading={isSendProposalButtonLoading}
          />
        }
      />
      <div className="relative mt-6">
        {dataIsLoading || !lazerState ? (
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

export default PythLazer
