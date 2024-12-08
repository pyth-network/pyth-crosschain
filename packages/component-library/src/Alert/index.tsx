"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Dialog, Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { Modal } from "../Modal/index.js";

export { DialogTrigger as AlertTrigger } from "react-aria-components";

const CLOSE_DURATION_IN_S = 0.1;
export const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_S * 1000;

type OwnProps = Pick<ComponentProps<typeof Modal>, "children"> & {
  icon?: ReactNode | undefined;
  title: ReactNode;
};

type Props = Omit<ComponentProps<typeof Dialog>, keyof OwnProps> & OwnProps;

export const Alert = ({
  icon,
  title,
  children,
  className,
  ...props
}: Props) => (
  <Modal
    overlayProps={{
      className: styles.modalOverlay ?? "",
    }}
    initial={{ y: "100%" }}
    animate={{
      y: 0,
      transition: { type: "spring", duration: 0.75, bounce: 0.5 },
    }}
    exit={{
      y: "100%",
      transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
    }}
    className={clsx(styles.modal, className)}
  >
    {(state) => (
      <Dialog className={styles.dialog ?? ""} {...props}>
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
        <Heading className={styles.title} slot="title">
          {icon && <div className={styles.icon}>{icon}</div>}
          <div>{title}</div>
        </Heading>
        <div className={styles.body}>
          {typeof children === "function" ? children(state) : children}
        </div>
      </Dialog>
    )}
  </Modal>
);
