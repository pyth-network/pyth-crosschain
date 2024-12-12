"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Dialog, Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { Modal } from "../Modal/index.js";

export { DialogTrigger as DrawerTrigger } from "react-aria-components";

const CLOSE_DURATION_IN_S = 0.15;
export const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_S * 1000;

type OwnProps = Pick<ComponentProps<typeof Modal>, "children"> & {
  title: ReactNode;
};

type Props = Omit<ComponentProps<typeof Dialog>, keyof OwnProps> & OwnProps;

export const Drawer = ({ title, children, className, ...props }: Props) => (
  <Modal
    overlayProps={{
      initial: { backgroundColor: "#00000000" },
      animate: { backgroundColor: "#00000080" },
      exit: { backgroundColor: "#00000000" },
      transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
      className: styles.modalOverlay ?? "",
    }}
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
    {(state) => (
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
        <div className={styles.body}>
          {typeof children === "function" ? children(state) : children}
        </div>
      </Dialog>
    )}
  </Modal>
);
