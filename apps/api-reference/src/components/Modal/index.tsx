import {
  Dialog,
  TransitionChild,
  Transition,
  DialogTitle,
  Description,
  DialogPanel,
  CloseButton,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { Button } from "../Button";

type ModalProps = {
  show: boolean;
  onClose: () => void;
  afterLeave?: (() => void) | undefined;
  children: ReactNode;
  title: string;
  description?: string;
};

export const Modal = ({
  show,
  onClose,
  afterLeave,
  children,
  title,
  description,
}: ModalProps) => (
  <Transition show={show} as={Fragment} {...(afterLeave && { afterLeave })}>
    <Dialog onClose={onClose} className="relative z-50">
      <TransitionChild
        as="div"
        className="fixed inset-0 bg-black/25 dark:bg-white/10"
        enter="transition-opacity ease-linear duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-32 text-center">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative w-full max-w-md rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all dark:bg-neutral-900 dark:shadow-white/5 md:max-w-xl lg:max-w-2xl xl:max-w-4xl">
              <DialogTitle
                as="h1"
                className="text-lg font-medium leading-6 text-neutral-800 dark:text-neutral-200 md:text-xl lg:text-2xl"
              >
                {title}
              </DialogTitle>
              <CloseButton className="absolute right-3 top-3 rounded-md p-2 text-neutral-500 transition hover:bg-black/10 dark:hover:bg-white/5">
                <XMarkIcon className="size-5" />
              </CloseButton>
              {description && (
                <Description className="mb-10 mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </Description>
              )}
              {children}
              <div className="mt-8 text-right">
                <CloseButton as={Button} className="px-4 py-2">
                  Close
                </CloseButton>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </Transition>
);
