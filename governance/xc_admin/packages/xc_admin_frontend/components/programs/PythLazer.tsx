import React, { useState, useContext } from 'react'
import { usePythContext } from '../../contexts/PythContext'
import { ClusterContext } from '../../contexts/ClusterContext'
import Modal from '../common/Modal'
import {
  validateUploadedConfig,
  ProgramType,
} from '@pythnetwork/xc-admin-common'
import toast from 'react-hot-toast'
import Loadbar from '../loaders/Loadbar'
import { LazerState } from '@pythnetwork/xc-admin-common/src/programs/types'

interface PythLazerProps {
  proposerServerUrl: string
}

interface ModalContentProps {
  changes: Record<
    string,
    {
      prev?: Partial<LazerState>
      new?: Partial<LazerState>
    }
  >
  onSendProposal: () => void
  isSendProposalButtonLoading: boolean
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
          <tbody>
            {Object.entries(changes).map(([key, change]) => (
              <tr key={key}>
                <td
                  className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                  colSpan={2}
                >
                  {key}
                </td>
                <td className="py-3 pl-6 pr-1 lg:pl-6">
                  <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs dark:bg-gray-700 dark:text-gray-300">
                    {JSON.stringify(change, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
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
          {isSendProposalButtonLoading ? 'Sending...' : 'Send Proposal'}
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

  const [dataChanges, setDataChanges] =
    useState<
      Record<string, { prev?: Partial<LazerState>; new?: Partial<LazerState> }>
    >()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)

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
    downloadAnchor.setAttribute('download', `lazer_config_${cluster}.json`)
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
              toast.error(error.message)
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
    try {
      // In a real implementation, this would send the proposal to the server
      await new Promise((resolve) => setTimeout(resolve, 2000)) // Mock delay

      // Close the modal and show success notification
      setIsModalOpen(false)
      toast.success('Proposal sent successfully!')
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    } finally {
      setIsSendProposalButtonLoading(false)
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
