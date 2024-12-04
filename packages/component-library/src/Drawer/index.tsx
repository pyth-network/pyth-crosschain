"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import { motion, AnimatePresence } from "motion/react";
import {
  type ComponentProps,
  type ReactNode,
  type ContextType,
  use,
  useCallback,
  useEffect,
} from "react";
import {
  Dialog,
  Heading,
  Modal as ModalComponent,
  ModalOverlay as ModalOverlayComponent,
  OverlayTriggerStateContext,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { useSetOverlayVisible } from "../overlay-visible-context.js";

export { DialogTrigger as DrawerTrigger } from "react-aria-components";

const CLOSE_DURATION_IN_S = 0.15;
export const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_S * 1000;

// @ts-expect-error Looks like there's a typing mismatch currently between
// motion and react, probably due to us being on react 19.  I'm expecting this
// will go away when react 19 is officially stabilized...
const ModalOverlay = motion.create(ModalOverlayComponent);
// @ts-expect-error Looks like there's a typing mismatch currently between
// motion and react, probably due to us being on react 19.  I'm expecting this
// will go away when react 19 is officially stabilized...
const Modal = motion.create(ModalComponent);

type OwnProps = {
  title: ReactNode;
  children:
    | ReactNode
    | ((
        state: NonNullable<ContextType<typeof OverlayTriggerStateContext>>,
      ) => ReactNode);
};

type Props = Omit<ComponentProps<typeof Dialog>, keyof OwnProps> & OwnProps;

export const Drawer = ({ title, children, className, ...props }: Props) => {
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
        <ModalOverlay
          isOpen
          isDismissable
          onOpenChange={onOpenChange}
          initial={{ backgroundColor: "#00000000" }}
          animate={{ backgroundColor: "#00000080" }}
          exit={{ backgroundColor: "#00000000" }}
          transition={{ ease: "linear", duration: CLOSE_DURATION_IN_S }}
          className={styles.modalOverlay ?? ""}
        >
          <Modal
            initial={{ x: "100%" }}
            animate={{
              x: 0,
              transition: { type: "spring", duration: 1, bounce: 0.35 },
            }}
            exit={{
              x: "100%",
              transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
            }}
            className={clsx(styles.modal, className)}
          >
            <Dialog className={styles.dialog ?? ""} {...props}>
              <div className={styles.heading}>
                <Heading className={styles.title} slot="title">
                  {title}
                </Heading>
                <Button
                  className={styles.closeButton ?? ""}
                  beforeIcon={(props) => <XCircle weight="fill" {...props} />}
                  slot="close"
                  hideText
                  rounded
                  variant="ghost"
                  size="sm"
                >
                  Close
                </Button>
              </div>
              {typeof children === "function" ? children(state) : children}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
};
