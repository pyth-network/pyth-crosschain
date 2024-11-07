"use client";

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
  noClose?: boolean | undefined;
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
  noClose,
  children,
  title,
  description,
  ...props
}: ModalDialogProps) => (
  <ModalOverlay
    isKeyboardDismissDisabled={closeDisabled === true || noClose === true}
    className="fixed left-0 top-0 z-50 h-[var(--visual-viewport-height)] w-screen overflow-y-auto bg-black/30 px-4 py-8 backdrop-blur data-[entering]:duration-300 data-[exiting]:duration-300 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out xs:py-16 sm:px-8 sm:py-32"
    isDismissable={!closeDisabled && !noClose}
    {...props}
  >
    <Modal className="pointer-events-none grid min-h-full place-content-center data-[entering]:duration-500 data-[exiting]:duration-300 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:zoom-in-90 data-[exiting]:zoom-out-110">
      <Dialog className="pointer-events-auto relative max-w-full border border-neutral-600/50 bg-[#100E21] px-4 py-6 pt-12 focus:outline-none sm:px-10 sm:pb-12">
        {(options) => (
          <>
            {!noClose && (
              <div className="absolute right-3 top-3">
                <Button
                  onPress={options.close}
                  className="size-10"
                  size="nopad"
                  isDisabled={closeDisabled ?? false}
                >
                  <XMarkIcon className="size-6" />
                </Button>
              </div>
            )}
            <Heading
              className={clsx("mr-10 text-3xl font-light", {
                "mb-4 md:mb-10": description === undefined,
              })}
              slot="title"
            >
              {title}
            </Heading>
            {description && (
              <p className="mb-4 mt-2 max-w-96 opacity-60 md:mb-10">
                {description}
              </p>
            )}
            {typeof children === "function" ? children(options) : children}
            {!noClose && closeButtonText !== undefined && (
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
