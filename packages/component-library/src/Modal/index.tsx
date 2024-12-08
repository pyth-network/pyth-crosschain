"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  type ComponentProps,
  type ContextType,
  type ReactNode,
  use,
  useCallback,
  useEffect,
} from "react";
import {
  Modal as ModalComponent,
  ModalOverlay,
  OverlayTriggerStateContext,
} from "react-aria-components";

import { useSetOverlayVisible } from "../overlay-visible-context.js";

// @ts-expect-error Looks like there's a typing mismatch currently between
// motion and react, probably due to us being on react 19.  I'm expecting this
// will go away when react 19 is officially stabilized...
const MotionModal = motion.create(ModalComponent);

// @ts-expect-error Looks like there's a typing mismatch currently between
// motion and react, probably due to us being on react 19.  I'm expecting this
// will go away when react 19 is officially stabilized...
const MotionModalOverlay = motion.create(ModalOverlay);

type OwnProps = {
  overlayProps?: Omit<
    ComponentProps<typeof MotionModalOverlay>,
    "isOpen" | "isDismissable" | "onOpenChange"
  >;
  children:
    | ReactNode
    | ((
        state: NonNullable<ContextType<typeof OverlayTriggerStateContext>>,
      ) => ReactNode);
};

type Props = Omit<ComponentProps<typeof MotionModal>, keyof OwnProps> &
  OwnProps;

export const Modal = ({ overlayProps, children, ...props }: Props) => {
  const state = use(OverlayTriggerStateContext);
  const { hideOverlay, showOverlay } = useSetOverlayVisible();

  useEffect(() => {
    if (state?.isOpen) {
      showOverlay();
    }
  }, [state, showOverlay]);

  const onOpenChange = useCallback(
    (newValue: boolean) => {
      state?.setOpen(newValue);
    },
    [state],
  );

  return (
    <AnimatePresence onExitComplete={hideOverlay}>
      {state?.isOpen && (
        <MotionModalOverlay
          isOpen
          isDismissable
          onOpenChange={onOpenChange}
          {...overlayProps}
        >
          <MotionModal {...props}>
            {typeof children === "function" ? children(state) : children}
          </MotionModal>
        </MotionModalOverlay>
      )}
    </AnimatePresence>
  );
};
