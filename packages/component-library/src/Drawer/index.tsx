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
  fill?: boolean | undefined;
  title: ReactNode;
  closeHref?: string | undefined;
  footer?: ReactNode | undefined;
  headingExtra?: ReactNode | undefined;
  headingClassName?: string | undefined;
  bodyClassName?: string | undefined;
  footerClassName?: string | undefined;
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
  fill,
  footer,
  headingClassName,
  bodyClassName,
  footerClassName,
  headingExtra,
  ...props
}: Props) => (
  <ModalDialog
    overlayVariants={{
      unmounted: { backgroundColor: "#00000000" },
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
      unmounted: {
        x: "calc(100% + 1rem)",
      },
    }}
    className={clsx(styles.drawer, className)}
    data-has-footer={footer === undefined ? undefined : ""}
    data-fill={fill ? "" : undefined}
    {...props}
  >
    {(...args) => (
      <>
        <div className={clsx(styles.heading, headingClassName)}>
          <Heading className={styles.title} slot="title">
            {title}
          </Heading>
          <div className={styles.headingEnd}>
            {headingExtra}
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
        </div>
        <div className={clsx(styles.body, bodyClassName)}>
          {typeof children === "function" ? children(...args) : children}
        </div>
        {footer && (
          <div className={clsx(styles.footer, footerClassName)}>{footer}</div>
        )}
      </>
    )}
  </ModalDialog>
);
