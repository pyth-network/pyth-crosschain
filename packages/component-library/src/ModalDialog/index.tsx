"use client";

import { motion } from "motion/react";
import {
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
  createContext,
  use,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  Modal,
  ModalOverlay,
  Dialog,
  DialogTrigger,
  Select,
} from "react-aria-components";

import { useSetOverlayVisible } from "../overlay-visible-context.js";

const MotionModalOverlay = motion.create(ModalOverlay);
const MotionDialog = motion.create(Dialog);

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
    onCloseFinish?: (() => void) | undefined;
  };

type Props = Omit<ComponentProps<typeof MotionDialog>, keyof OwnProps> &
  OwnProps;

export const ModalDialog = ({
  isOpen,
  onOpenChange,
  onCloseFinish,
  overlayClassName,
  overlayVariants,
  children,
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
          <MotionDialog {...props}>
            {typeof children === "function" ? children(...args) : children}
          </MotionDialog>
        )}
      </Modal>
    </MotionModalOverlay>
  );
};

type AnimationState = "unmounted" | "hidden" | "visible";
