import cx from "clsx";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import type {
  PopoverProps as AriaPopoverProps,
  DialogProps,
} from "react-aria-components";
import {
  Popover as AriaPopover,
  Dialog,
  DialogTrigger,
} from "react-aria-components";

import classes from "./index.module.scss";

export type PopoverProps = PropsWithChildren &
  Omit<ComponentProps<typeof DialogTrigger>, "children"> & {
    /**
     * Additional options to apply directly to the dialog
     */
    dialogProps?: DialogProps;

    /**
     * The content to display in the popover
     */
    popoverContents: ReactNode;

    /**
     * Additional options to apply directly to the popover
     */
    popoverProps?: AriaPopoverProps;

    /**
     * The surface to render the popover on; `tooltip` is an inverted chip for
     * short bits of transient content, `menu` is a regular elevated surface for
     * menus and lists.
     */
    variant?: "tooltip" | "menu";
  };

export function Popover({
  children,
  dialogProps,
  popoverContents,
  popoverProps,
  variant = "tooltip",
  ...rest
}: PopoverProps) {
  const { className, placement, ...popoverRest } = popoverProps ?? {};

  return (
    <DialogTrigger {...rest}>
      {children}
      <AriaPopover
        {...popoverRest}
        className={cx(
          classes.popoverRoot,
          variant === "menu" && classes.menu,
          className,
        )}
        placement={placement ?? "bottom"}
      >
        <Dialog {...dialogProps}>{popoverContents}</Dialog>
      </AriaPopover>
    </DialogTrigger>
  );
}
