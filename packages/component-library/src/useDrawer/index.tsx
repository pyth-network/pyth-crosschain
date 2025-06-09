import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import { useMediaQuery } from "@react-hookz/web";
import clsx from "clsx";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { useIsSSR } from "react-aria";
import { Heading } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";
import type { ModalDialogProps } from "../ModalDialog/index.jsx";
import {
  ModalDialog,
  createModalDialogContext,
} from "../ModalDialog/index.jsx";

const CLOSE_DURATION_IN_S = 0.15;

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
  setMainContentOffset: (value: number) => void;
  contents: ReactNode | undefined;
  variant?: "default" | "dialog" | undefined;
};

type Props = Omit<
  ComponentProps<typeof ModalDialog>,
  | keyof OwnProps
  | "overlayVariants"
  | "overlayClassName"
  | "variants"
  | "children"
> &
  OwnProps;

const Drawer = ({
  className,
  title,
  closeHref,
  contents,
  fill,
  footer,
  headingClassName,
  bodyClassName,
  footerClassName,
  headingExtra,
  headingAfter,
  hideHeading,
  setMainContentOffset,
  variant = "default",
  ...props
}: Props) => {
  const [isHandlePressed, setIsHandlePressed] = useState(false);
  const { isDragging, props: animationProps } = useAnimationProps(
    variant,
    setMainContentOffset,
  );
  const isLarge = useIsLarge();

  const wasPreviouslyLarge = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (isLarge !== undefined) {
      if (wasPreviouslyLarge.current === undefined) {
        wasPreviouslyLarge.current = isLarge;
      } else if (isLarge !== wasPreviouslyLarge.current) {
        wasPreviouslyLarge.current = isLarge;
        setMainContentOffset(isLarge ? 0 : 100);
      }
    }
  }, [isLarge, setMainContentOffset]);

  return (
    <ModalDialog
      key={`modal-dialog-${isLarge ? "large" : "small"}`}
      data-variant={variant}
      overlayVariants={{
        unmounted: { backgroundColor: "#00000000" },
        hidden: { backgroundColor: "#00000000" },
        visible: { backgroundColor: "#00000080" },
      }}
      overlayClassName={styles.modalOverlay ?? ""}
      className={clsx(styles.drawer, className)}
      data-has-footer={footer === undefined ? undefined : ""}
      data-fill={fill ? "" : undefined}
      data-hide-heading={hideHeading ? "" : undefined}
      {...animationProps}
      {...props}
    >
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
              beforeIcon={<XCircle weight="fill" />}
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
      <div className={clsx(styles.body, bodyClassName)}>{contents}</div>
      {footer && (
        <div className={clsx(styles.footer, footerClassName)}>{footer}</div>
      )}
    </ModalDialog>
  );
};

const useAnimationProps = (
  variant: Props["variant"],
  setMainContentOffset: (value: number) => void,
): {
  isDragging: boolean;
  props: Partial<ComponentProps<typeof ModalDialog>>;
} => {
  const modalRef = useRef<null | HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const y = useMotionValue("100%");

  useMotionValueEvent(y, "change", (y) => {
    if (typeof y === "string") {
      setMainContentOffset(100 - Number.parseInt(y.replace(/%$/, ""), 10));
    } else if (modalRef.current) {
      setMainContentOffset(100 - (100 * y) / modalRef.current.offsetHeight);
    }
  });
  const isLarge = useIsLarge();

  const commonProps = {
    ref: modalRef,
  };

  return isLarge
    ? {
        isDragging: false,
        props: {
          ...commonProps,
          variants:
            variant === "dialog"
              ? {
                  visible: {
                    y: 0,
                    transition: { type: "spring", duration: 0.8, bounce: 0.35 },
                  },
                  hidden: {
                    y: "calc(-100% - 8rem)",
                    transition: {
                      ease: "linear",
                      duration: CLOSE_DURATION_IN_S,
                    },
                  },
                  unmounted: {
                    y: "calc(-100% - 8rem)",
                  },
                }
              : {
                  visible: {
                    x: 0,
                    transition: { type: "spring", duration: 1, bounce: 0.35 },
                  },
                  hidden: {
                    x: "calc(100% + 1rem)",
                    transition: {
                      ease: "linear",
                      duration: CLOSE_DURATION_IN_S,
                    },
                  },
                  unmounted: {
                    x: "calc(100% + 1rem)",
                  },
                },
        },
      }
    : {
        isDragging,
        props: {
          ...commonProps,
          variants: {
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
          },
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
        },
      };
};

const useIsLarge = () => {
  const isSSR = useIsSSR();
  const breakpoint = useMemo(
    () =>
      isSSR
        ? ""
        : getComputedStyle(
            globalThis.document.documentElement,
          ).getPropertyValue("--breakpoint-sm"),
    [isSSR],
  );
  return useMediaQuery(`(min-width: ${breakpoint})`);
};

const { Provider, useValue } = createModalDialogContext<
  Props,
  Pick<Props, "setMainContentOffset">
>(Drawer);

export const DrawerProvider = Provider;
export const useDrawer = useValue;
export type OpenDrawerArgs = ModalDialogProps<
  Props,
  Pick<Props, "setMainContentOffset">
>;
