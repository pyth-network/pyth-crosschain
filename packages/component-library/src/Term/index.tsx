"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogTrigger,
  OverlayArrow,
  Popover,
  Button,
} from "react-aria-components";

import styles from "./index.module.scss";

const HOVER_END_DELAY = 250;

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
  term: ReactNode;
  children: ReactNode;
};

export const Term = ({ className, children, term, ...props }: Props) => {
  const didEscape = useRef(false);
  const closeTimeout = useRef<undefined | ReturnType<typeof setTimeout>>(
    undefined,
  );
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(newValue) => {
        if (!newValue) {
          setIsOpen(false);
          didEscape.current = true;
        }
      }}
    >
      <Button
        className={clsx(className, styles.term)}
        onHoverStart={() => {
          setIsOpen(true);
          if (closeTimeout.current) {
            clearTimeout(closeTimeout.current);
            closeTimeout.current = undefined;
          }
        }}
        onHoverEnd={() => {
          closeTimeout.current = setTimeout(() => {
            setIsOpen(false);
          }, HOVER_END_DELAY);
          didEscape.current = false;
        }}
        onFocus={() => {
          if (!didEscape.current) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          didEscape.current = false;
        }}
        onPress={() => {
          setIsOpen(true);
        }}
        {...props}
      >
        {term}
        <span className={styles.question}>?</span>
      </Button>
      <Popover className={styles.popover ?? ""} isNonModal placement="top">
        <OverlayArrow className={styles.arrow ?? ""}>
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
        <Dialog className={styles.dialog ?? ""}>{children}</Dialog>
      </Popover>
    </DialogTrigger>
  );
};
