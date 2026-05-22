"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Heading } from "react-aria-components";
import { Button } from "../Button/index.jsx";
import type { ModalDialogProps } from "../ModalDialog/index.jsx";
import {
  createModalDialogContext,
  ModalDialog,
} from "../ModalDialog/index.jsx";
import styles from "./index.module.scss";

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
    className={clsx(styles.alert, className)}
    overlayClassName={styles.modalOverlay ?? ""}
    variants={{
      hidden: {
        transition: { duration: CLOSE_DURATION_IN_S, ease: "linear" },
        y: "calc(100% + 2rem)",
      },
      unmounted: { y: "calc(100% + 2rem)" },
      visible: {
        transition: { bounce: 0.5, duration: 0.75, type: "spring" },
        y: 0,
      },
    }}
    {...props}
  >
    <Button
      beforeIcon={<XCircle weight="fill" />}
      className={styles.closeButton ?? ""}
      hideText
      rounded
      size="sm"
      slot="close"
      variant="ghost"
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
