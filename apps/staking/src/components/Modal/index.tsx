import {
  Dialog,
  DialogBackdrop,
  DialogTitle,
  Description,
  DialogPanel,
  CloseButton,
  Transition,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  type ReactNode,
  type ComponentProps,
  type ElementType,
  type Dispatch,
  type SetStateAction,
  useState,
  useCallback,
  useContext,
  createContext,
} from "react";

import { Button } from "../Button";

const ModalContext = createContext<
  [boolean, Dispatch<SetStateAction<boolean>>] | undefined
>(undefined);

export const Modal = (
  props: Omit<ComponentProps<typeof ModalContext.Provider>, "value">,
) => {
  const state = useState(false);
  return <ModalContext.Provider value={state} {...props} />;
};

const useModalContext = () => {
  const ctx = useContext(ModalContext);
  if (ctx === undefined) {
    throw new ContextNotInitializedError();
  }
  return ctx;
};

class ContextNotInitializedError extends Error {
  constructor() {
    super("You cannot use this component outside of a <Modal> parent!");
  }
}

type ModalButtonProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
};

export const ModalButton = <T extends ElementType>({
  as,
  ...props
}: ModalButtonProps<T>) => {
  const Component = as ?? Button;
  const [, setState] = useModalContext();
  const toggle = useCallback(() => {
    setState((cur) => !cur);
  }, [setState]);
  return <Component onClick={toggle} {...props} />;
};

export const ModalPanel = (
  props: Omit<RawModalProps, "isOpen" | "onClose">,
) => {
  const [state, setState] = useModalContext();
  const onClose = useCallback(() => {
    setState(false);
  }, [setState]);

  return <RawModal isOpen={state} onClose={onClose} {...props} />;
};

type RawModalProps = {
  isOpen: boolean;
  onClose: () => void;
  closeDisabled?: boolean | undefined;
  afterLeave?: (() => void) | undefined;
  title: ReactNode | ReactNode[];
  description?: string;
  children?:
    | ((onClose: () => void) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
};

export const RawModal = ({
  isOpen,
  onClose,
  closeDisabled,
  afterLeave,
  children,
  title,
  description,
}: RawModalProps) => {
  const handleClose = useCallback(() => {
    if (!closeDisabled) {
      onClose();
    }
  }, [closeDisabled, onClose]);

  return (
    <Transition show={isOpen} {...(afterLeave && { afterLeave })}>
      <Dialog
        static
        open={isOpen}
        onClose={handleClose}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 backdrop-blur duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative border border-neutral-600/50 bg-[#100E21] px-10 py-12 duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <DialogTitle as="h2" className="text-3xl font-light leading-6">
              {title}
            </DialogTitle>
            <CloseButton
              as={Button}
              className="absolute right-3 top-3 grid size-10 place-content-center"
              nopad
              disabled={closeDisabled ?? false}
            >
              <XMarkIcon className="size-6" />
            </CloseButton>
            {description && (
              <Description className="mb-10 mt-2 max-w-96 opacity-60">
                {description}
              </Description>
            )}
            {typeof children === "function" ? children(handleClose) : children}
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
};
