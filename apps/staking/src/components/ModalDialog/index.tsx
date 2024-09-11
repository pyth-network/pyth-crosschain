import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

import { Button } from "../Button";

// This type currently isn't exported by react-aria-components, so we reconstruct it here...
type DialogRenderProps = Parameters<
  Exclude<ComponentProps<typeof Dialog>["children"], ReactNode>
>[0];

type ModalDialogProps = Omit<
  ComponentProps<typeof ModalOverlay>,
  "children"
> & {
  closeDisabled?: boolean | undefined;
  closeButtonText?: string;
  title: ReactNode | ReactNode[];
  description?: ReactNode;
  children?:
    | ((options: DialogRenderProps) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
};

export const ModalDialog = ({
  closeDisabled,
  closeButtonText,
  children,
  title,
  description,
  ...props
}: ModalDialogProps) => (
  <ModalOverlay
    isKeyboardDismissDisabled={closeDisabled === true}
    className="fixed left-0 top-0 z-50 grid h-[var(--visual-viewport-height)] w-screen place-content-center bg-black/30 backdrop-blur data-[entering]:duration-300 data-[exiting]:duration-300 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out"
    isDismissable={!closeDisabled}
    {...props}
  >
    <Modal className="data-[entering]:duration-500 data-[exiting]:duration-300 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:zoom-in-90 data-[exiting]:zoom-out-110">
      <Dialog className="relative mx-8 border border-neutral-600/50 bg-[#100E21] px-6 pb-8 pt-12 focus:outline-none sm:px-10 sm:pb-12">
        {(options) => (
          <>
            <Button
              onPress={options.close}
              className="absolute right-3 top-3 grid size-10 place-content-center"
              size="nopad"
              isDisabled={closeDisabled ?? false}
            >
              <XMarkIcon className="size-6" />
            </Button>
            <Heading
              className={clsx("text-3xl font-light leading-6", {
                "mb-10": description === undefined,
              })}
              slot="title"
            >
              {title}
            </Heading>
            {description && (
              <p className="mb-10 mt-2 max-w-96 opacity-60">{description}</p>
            )}
            {typeof children === "function" ? children(options) : children}
            {closeButtonText !== undefined && (
              <div className="mt-14 flex flex-row justify-end">
                <Button size="noshrink" onPress={options.close}>
                  {closeButtonText}
                </Button>
              </div>
            )}
          </>
        )}
      </Dialog>
    </Modal>
  </ModalOverlay>
);
