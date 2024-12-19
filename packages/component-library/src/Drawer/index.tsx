"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { ModalDialog } from "../ModalDialog/index.js";

export { ModalDialogTrigger as DrawerTrigger } from "../ModalDialog/index.js";

const CLOSE_DURATION_IN_S = 0.15;
export const CLOSE_DURATION_IN_MS = CLOSE_DURATION_IN_S * 1000;

type OwnProps = {
  title: ReactNode;
  closeHref?: string | undefined;
};

type Props = Omit<
  ComponentProps<typeof ModalDialog>,
  keyof OwnProps | "overlayVariants" | "overlayClassName" | "variants"
> &
  OwnProps;

export const Drawer = ({
  className,
  title,
  closeHref,
  children,
  ...props
}: Props) => (
  <ModalDialog
    overlayVariants={{
      hidden: { backgroundColor: "#00000000" },
      visible: { backgroundColor: "#00000080" },
    }}
    overlayClassName={styles.modalOverlay ?? ""}
    variants={{
      visible: {
        x: 0,
        transition: { type: "spring", duration: 1, bounce: 0.35 },
      },
      hidden: {
        x: "calc(100% + 1rem)",
        transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
      },
    }}
    className={clsx(styles.drawer, className)}
    {...props}
  >
    {(...args) => (
      <>
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
            {...(closeHref && { href: closeHref })}
          >
            Close
          </Button>
        </div>
        <div className={styles.body}>
          {typeof children === "function" ? children(...args) : children}
        </div>
      </>
    )}
  </ModalDialog>
);
