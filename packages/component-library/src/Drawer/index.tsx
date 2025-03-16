"use client";

import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { useMediaQuery } from "@react-hookz/web";
import clsx from "clsx";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import { Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { useMainContentOffset } from "../MainContent/index.js";
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
  headingAfter?: ReactNode | undefined;
  headingClassName?: string | undefined;
  bodyClassName?: string | undefined;
  footerClassName?: string | undefined;
  hideHeading?: boolean | undefined;
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
  headingAfter,
  hideHeading,
  ...props
}: Props) => {
  const [, setMainContentOffset] = useMainContentOffset();
  const modalRef = useRef<null | HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHandlePressed, setIsHandlePressed] = useState(false);
  const isLarge = useMediaQuery(
    `(min-width: ${styles["breakpoint-sm"] ?? ""})`,
  );
  const y = useMotionValue("100%");

  useMotionValueEvent(y, "change", (y) => {
    if (typeof y === "string") {
      setMainContentOffset(100 - Number.parseInt(y.replace(/%$/, ""), 10));
    } else if (modalRef.current) {
      setMainContentOffset(100 - (100 * y) / modalRef.current.offsetHeight);
    }
  });

  return (
    <ModalDialog
      ref={modalRef}
      overlayVariants={{
        unmounted: { backgroundColor: "#00000000" },
        hidden: { backgroundColor: "#00000000" },
        visible: { backgroundColor: "#00000080" },
      }}
      overlayClassName={styles.modalOverlay ?? ""}
      variants={
        isLarge
          ? {
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
            }
          : {
              visible: {
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: [0.32, 0.72, 0, 1],
                },
              },
              hidden: {
                y: "100%",
                transition: { ease: "linear", duration: CLOSE_DURATION_IN_S },
              },
              unmounted: {
                y: "100%",
              },
            }
      }
      {...(!isLarge && {
        style: { y },
        drag: "y",
        dragConstraints: { top: 0 },
        dragElastic: false,
        dragPropagation: true,
        onDragStart: () => {
          setIsDragging(true);
        },
        onDragEnd: (e, { velocity }, { state }) => {
          setIsDragging(false);
          if (e.type !== "pointercancel" && velocity.y > 10) {
            state.close();
          } else {
            animate(y, "0", {
              type: "inertia",
              bounceStiffness: 300,
              bounceDamping: 40,
              timeConstant: 300,
              min: 0,
              max: 0,
            });
          }
        },
      })}
      className={clsx(styles.drawer, className)}
      data-has-footer={footer === undefined ? undefined : ""}
      data-fill={fill ? "" : undefined}
      data-hide-heading={hideHeading ? "" : undefined}
      {...props}
    >
      {(...args) => (
        <>
          <OnResize
            threshold={styles["breakpoint-sm"]}
            onResize={() => {
              setMainContentOffset(0);
              args[0].state.close();
            }}
          />
          <div
            className={styles.handle}
            onPointerDown={() => {
              setIsHandlePressed(true);
            }}
            onPointerUp={() => {
              setIsHandlePressed(false);
            }}
            data-is-pressed={isHandlePressed || isDragging ? "" : undefined}
          />
          <div className={clsx(styles.heading, headingClassName)}>
            <div className={styles.headingTop}>
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
            {headingAfter}
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
};

type OnResizeProps = {
  threshold: string | undefined;
  onResize: () => void;
};

const OnResize = ({ threshold, onResize }: OnResizeProps) => {
  const isAboveThreshold = useMediaQuery(`(min-width: ${threshold ?? ""})`, {
    initializeWithValue: false,
  });
  const previousValue = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (previousValue.current === undefined) {
      previousValue.current = isAboveThreshold;
    } else if (isAboveThreshold !== previousValue.current) {
      previousValue.current = isAboveThreshold;
      onResize();
    }
  }, [isAboveThreshold, onResize]);
  // eslint-disable-next-line unicorn/no-null
  return null;
};
