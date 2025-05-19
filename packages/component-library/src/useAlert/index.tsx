"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";
import type { ModalDialogProps } from "../ModalDialog/index.jsx";
import {
  ModalDialog,
  createModalDialogContext,
} from "../ModalDialog/index.jsx";

const CLOSE_DURATION_IN_S = 0.1;

type OwnProps = {
  icon?: ReactNode | undefined;
  title: ReactNode;
  bodyClassName?: string | undefined;
  contents: ReactNode;
};

type Props = Omit<
  ComponentProps<typeof ModalDialog>,
  keyof OwnProps | "overlayClassName"
> &
  OwnProps;

const Alert = ({
  icon,
  title,
  contents,
  className,
  bodyClassName,
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
    <Button
      className={styles.closeButton ?? ""}
      beforeIcon={<XCircle weight="fill" />}
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
    <div className={clsx(styles.body, bodyClassName)}>{contents}</div>
  </ModalDialog>
);

const { Provider, useValue } = createModalDialogContext<Props>(Alert);

export const AlertProvider = Provider;
export const useAlert = useValue;
export type OpenAlertArgs = ModalDialogProps<Props>;
