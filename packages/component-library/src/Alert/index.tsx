"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { ModalDialog } from "../ModalDialog/index.js";

export { ModalDialogTrigger as AlertTrigger } from "../ModalDialog/index.js";

const CLOSE_DURATION_IN_S = 0.1;
export const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_S * 1000;

type OwnProps = Pick<ComponentProps<typeof ModalDialog>, "children"> & {
  icon?: ReactNode | undefined;
  title: ReactNode;
};

type Props = Omit<
  ComponentProps<typeof ModalDialog>,
  keyof OwnProps | "overlayClassName"
> &
  OwnProps;

export const Alert = ({
  icon,
  title,
  children,
  className,
  ...props
}: Props) => (
  <ModalDialog
    overlayClassName={styles.modalOverlay ?? ""}
    variants={{
      visible: {
        y: 0,
        transition: { type: "spring", duration: 0.75, bounce: 0.5 },
      },
      hidden: {
        y: "calc(100% + 2rem)",
        transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
      },
      unmounted: { y: "calc(100% + 2rem)" },
    }}
    className={clsx(styles.alert, className)}
    {...props}
  >
    {(...args) => (
      <>
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
          {typeof children === "function" ? children(...args) : children}
        </div>
      </>
    )}
  </ModalDialog>
);
