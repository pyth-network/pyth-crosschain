import {
  Dialog,
  DialogBackdrop,
  DialogTitle,
  Description,
  DialogPanel,
  CloseButton,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { Button } from "../Button";

type Props = {
  open: boolean;
  onClose: () => void;
  closeDisabled?: boolean | undefined;
  afterLeave?: (() => void) | undefined;
  children?: ReactNode | ReactNode[] | undefined;
  title: string;
  description?: string;
  additionalButtons?: ReactNode | ReactNode[] | undefined;
};

export const Modal = ({
  open,
  onClose,
  closeDisabled,
  children,
  title,
  description,
  additionalButtons,
}: Props) => (
  <Dialog open={open} onClose={onClose} className="relative z-50">
    <DialogBackdrop
      transition
      className="fixed inset-0 bg-black/30 duration-300 ease-out data-[closed]:opacity-0"
    />
    <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
      <DialogPanel
        transition
        className="relative max-w-lg rounded-md bg-white p-8 duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <DialogTitle
          as="h1"
          className="text-lg font-medium leading-6 text-neutral-800 dark:text-neutral-200 md:text-xl lg:text-2xl"
        >
          {title}
        </DialogTitle>
        {closeDisabled !== true && (
          <CloseButton className="absolute right-3 top-3 rounded-md p-2 text-neutral-500 transition hover:bg-black/10 dark:hover:bg-white/5">
            <XMarkIcon className="size-5" />
          </CloseButton>
        )}
        {description && (
          <Description className="mb-10 mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </Description>
        )}
        {children}
        <div className="mt-8 flex flex-row justify-end gap-4 text-right">
          <CloseButton
            as={Button}
            className="px-4 py-2"
            disabled={closeDisabled ?? false}
          >
            Close
          </CloseButton>
          {additionalButtons}
        </div>
      </DialogPanel>
    </div>
  </Dialog>
);
