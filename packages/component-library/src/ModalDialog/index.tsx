"use client";

import type { MotionProps, PanInfo } from "motion/react";
import { motion } from "motion/react";
import type {
  ComponentProps,
  ComponentType,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import {
  createContext,
  use,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import type { ModalRenderProps } from "react-aria-components";
import {
  Modal,
  ModalOverlay,
  Dialog,
  DialogTrigger,
  Select,
} from "react-aria-components";

import { useSetOverlayVisible } from "../overlay-visible-context.jsx";

// These types are absurd, but the annotations have to be here or else we get a
// TS2742 due to some issue in how framer-motion is packaged.  Eventually it
// would be great to figure out what about framer-motion's packaging causes this
// to be required, and to find a way to make it a nonissue, but for now these
// annotations will allow us to move on...
const MotionModalOverlay: ComponentType<
  Omit<ComponentProps<typeof ModalOverlay>, keyof MotionProps> &
    Omit<MotionProps, "children"> & {
      children?:
        | MotionProps["children"]
        | ComponentProps<typeof ModalOverlay>["children"];
    }
> = motion.create(ModalOverlay);
const MotionDialog: ComponentType<
  Omit<ComponentProps<typeof Dialog>, keyof MotionProps> &
    Omit<MotionProps, "children"> & {
      children?:
        | MotionProps["children"]
        | ComponentProps<typeof Dialog>["children"];
    }
> = motion.create(Dialog);

export const ModalDialogTrigger = (
  props: ComponentProps<typeof DialogTrigger>,
) => {
  const [animation, setAnimation] = useState<AnimationState>("unmounted");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setAnimation(isOpen ? "visible" : "hidden");
    },
    [setAnimation],
  );

  useEffect(() => {
    if (props.defaultOpen) {
      setAnimation("visible");
    }
  }, [props.defaultOpen]);

  return (
    <ModalAnimationContext value={[animation, setAnimation]}>
      <DialogTrigger onOpenChange={handleOpenChange} {...props} />
    </ModalAnimationContext>
  );
};

export const ModalSelect = (props: ComponentProps<typeof DialogTrigger>) => {
  const [animation, setAnimation] = useState<AnimationState>("unmounted");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setAnimation(isOpen ? "visible" : "hidden");
    },
    [setAnimation],
  );

  return (
    <ModalAnimationContext value={[animation, setAnimation]}>
      <Select onOpenChange={handleOpenChange} {...props} />
    </ModalAnimationContext>
  );
};

const ModalAnimationContext = createContext<
  [AnimationState, Dispatch<SetStateAction<AnimationState>>] | undefined
>(undefined);

type OwnProps = Pick<ComponentProps<typeof Modal>, "children"> &
  Pick<ComponentProps<typeof MotionModalOverlay>, "isOpen" | "onOpenChange"> & {
    overlayClassName?:
      | ComponentProps<typeof MotionModalOverlay>["className"]
      | undefined;
    overlayVariants?:
      | ComponentProps<typeof MotionModalOverlay>["variants"]
      | undefined;
    onClose?: (() => void) | undefined;
    onCloseFinish?: (() => void) | undefined;
    onDragEnd?: (
      e: MouseEvent | TouchEvent | PointerEvent,
      panInfo: PanInfo,
      modalState: ModalRenderProps,
    ) => void;
  };

type Props = Omit<ComponentProps<typeof MotionDialog>, keyof OwnProps> &
  OwnProps;

export const ModalDialog = ({
  isOpen,
  onOpenChange,
  onClose,
  onCloseFinish,
  overlayClassName,
  overlayVariants,
  children,
  onDragEnd,
  ...props
}: Props) => {
  const contextAnimationState = use(ModalAnimationContext);
  const localAnimationState = useState<AnimationState>("unmounted");
  const [animation, setAnimation] =
    contextAnimationState ?? localAnimationState;
  const { hideOverlay, showOverlay } = useSetOverlayVisible();

  const startAnimation = (animation: AnimationState) => {
    if (animation === "visible") {
      showOverlay();
    } else if (animation === "hidden") {
      onClose?.();
    }
  };

  const endAnimation = (animation: AnimationState) => {
    if (animation === "hidden") {
      hideOverlay();
      onCloseFinish?.();
    }
    setAnimation((a) => {
      return animation === "hidden" && a === "hidden" ? "unmounted" : a;
    });
  };

  useEffect(() => {
    if (isOpen !== undefined) {
      setAnimation((a) => {
        if (isOpen) {
          return "visible";
        } else {
          return a === "visible" ? "hidden" : a;
        }
      });
    }
  }, [isOpen, setAnimation]);

  return (
    <MotionModalOverlay
      isDismissable
      isExiting={animation === "hidden"}
      onAnimationStart={startAnimation}
      onAnimationComplete={endAnimation}
      initial="unmounted"
      animate={animation}
      {...(onOpenChange && { onOpenChange })}
      {...(overlayVariants && { variants: overlayVariants })}
      {...(overlayClassName && { className: overlayClassName })}
      {...(isOpen !== undefined && { isOpen })}
    >
      <Modal style={{ height: 0 }}>
        {(...args) => (
          <MotionDialog
            {...props}
            {...(onDragEnd && {
              onDragEnd: (e, info) => {
                onDragEnd(e, info, args[0]);
              },
            })}
          >
            {typeof children === "function" ? children(...args) : children}
          </MotionDialog>
        )}
      </Modal>
    </MotionModalOverlay>
  );
};

type AnimationState = "unmounted" | "hidden" | "visible";

export const createModalDialogContext = <
  T extends Props,
  U = Record<never, never>,
>(
  Component: ComponentType<T>,
) => {
  type ContextType = {
    close: () => Promise<void>;
    open: (modalDialogProps: OpenArgs<T, U>) => void;
  };

  const Context = createContext<ContextType | undefined>(undefined);

  return {
    Provider: ({ children, ...ctxProps }: U & { children: ReactNode }) => {
      const promiseCloseResolvers = useRef<(() => void)[]>([]);
      const [isOpen, setIsOpen] = useState(false);
      const [currentModalDialog, setModalDialog] = useState<
        OpenArgs<T, U> | undefined
      >(undefined);
      const close = useCallback(() => {
        setIsOpen(false);
        return new Promise<void>((resolve) => {
          promiseCloseResolvers.current.push(resolve);
        });
      }, []);
      const open = useCallback(
        (props: OpenArgs<T, U>) => {
          if (currentModalDialog && currentModalDialog !== props) {
            close()
              .then(() => {
                setTimeout(() => {
                  setModalDialog(props);
                  setIsOpen(true);
                });
              })
              .catch((error: unknown) => {
                throw error;
              });
          } else if (!currentModalDialog) {
            setModalDialog(props);
            setIsOpen(true);
          }
        },
        [currentModalDialog, setModalDialog, close],
      );
      const handleOpenChange = useCallback(
        (newValue: boolean) => {
          if (!newValue) {
            setIsOpen(false);
          }
        },
        [setIsOpen],
      );
      const handleCloseFinish = useCallback(() => {
        const onCloseFinished = currentModalDialog?.onCloseFinished;
        setModalDialog(undefined);
        onCloseFinished?.();
        for (const resolver of promiseCloseResolvers.current) {
          resolver();
        }
        promiseCloseResolvers.current = [];
      }, [setModalDialog, currentModalDialog]);

      return (
        <Context value={{ open, close }}>
          {children}
          {currentModalDialog !== undefined && (
            // @ts-expect-error TODO typescript isn't validating this type
            // properly.  To be honest, I'm not sure why, but the code for
            // `createModalDialogContext` is pretty messy and I think
            // simplifying this would probably resolve the issue.  I'll come
            // back and refactor this eventually and see if this goes away...
            <Component
              isOpen={isOpen}
              onOpenChange={handleOpenChange}
              onCloseFinish={handleCloseFinish}
              {...ctxProps}
              {...currentModalDialog}
            />
          )}
        </Context>
      );
    },

    useValue: () => {
      const value = use(Context);
      if (value === undefined) {
        throw new ContextNotInitializedError();
      } else {
        return value;
      }
    },
  };
};

export type OpenArgs<T, U = undefined> = Omit<
  T,
  "isOpen" | "onOpenChange" | "onCloseFinish" | keyof U
> & {
  onClose?: (() => void) | undefined;
  onCloseFinished?: (() => void) | undefined;
};

class ContextNotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a provider");
    this.name = "ContextNotInitializedError";
  }
}
