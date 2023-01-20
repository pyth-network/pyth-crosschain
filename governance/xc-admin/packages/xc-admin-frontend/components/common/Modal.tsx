import { Dialog, Transition } from '@headlessui/react'
import { Dispatch, Fragment, SetStateAction } from 'react'
import CloseIcon from '../icons/CloseIcon'
import Spinner from './Spinner'

const Modal: React.FC<{
  isModalOpen: boolean
  setIsModalOpen: Dispatch<SetStateAction<boolean>>
  closeModal: () => void
  changes: any
  handleSendProposalButtonClick: () => void
  isSendProposalButtonLoading: boolean
}> = ({
  isModalOpen,
  setIsModalOpen,
  closeModal,
  changes,
  handleSendProposalButtonClick,
  isSendProposalButtonLoading,
}) => {
  return (
    <Transition appear show={isModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={() => setIsModalOpen(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="diaglogPanel">
                <button className="diaglogClose" onClick={closeModal}>
                  <span className="mr-3">close</span> <CloseIcon />
                </button>
                <div className="max-w-full">
                  <Dialog.Title as="h3" className="diaglogTitle">
                    Proposed Changes
                  </Dialog.Title>

                  {Object.keys(changes).length === 0 ? (
                    <p className="mb-8 leading-6 ">No proposed changes.</p>
                  ) : (
                    Object.keys(changes).map((key) => {
                      if (changes[key].prev !== changes[key].new) {
                        return (
                          <div key={key} className="flex justify-between pb-4">
                            <span className="pr-4 font-bold">{key}</span>
                            <span className="mr-2">
                              {changes[key].prev} &rarr; {changes[key].new}
                            </span>
                          </div>
                        )
                      }
                    })
                  )}

                  <button
                    className="action-btn text-base "
                    onClick={handleSendProposalButtonClick}
                    disabled={Object.keys(changes).length === 0}
                  >
                    {isSendProposalButtonLoading ? (
                      <Spinner />
                    ) : (
                      'Send Proposal'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default Modal
