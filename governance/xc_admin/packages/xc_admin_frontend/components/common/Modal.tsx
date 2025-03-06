import { Dialog, Transition } from '@headlessui/react'
import { Dispatch, Fragment, SetStateAction } from 'react'
import CloseIcon from '../icons/CloseIcon'

const Modal: React.FC<{
  isModalOpen: boolean
  setIsModalOpen: Dispatch<SetStateAction<boolean>>
  closeModal: () => void
  content: any // eslint-disable-line @typescript-eslint/no-explicit-any
}> = ({ isModalOpen, setIsModalOpen, closeModal, content }) => {
  return (
    <Transition appear show={isModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-40"
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
              <Dialog.Panel className="dialogPanel">
                <button className="dialogClose" onClick={closeModal}>
                  <span className="mr-3">close</span> <CloseIcon />
                </button>
                <div className="max-w-full">
                  <Dialog.Title as="h3" className="dialogTitle">
                    Proposed Changes
                  </Dialog.Title>
                  {content}
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
