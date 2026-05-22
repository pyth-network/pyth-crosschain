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
  };

export function Popover({
  children,
  dialogProps,
  popoverContents,
  popoverProps,
  ...rest
}: PopoverProps) {
  const { className, placement, ...popoverRest } = popoverProps ?? {};

  return (
    <DialogTrigger {...rest}>
      {children}
      <AriaPopover
        {...popoverRest}
        className={cx(classes.popoverRoot, className)}
        placement={placement ?? "bottom"}
      >
        <Dialog {...dialogProps}>{popoverContents}</Dialog>
      </AriaPopover>
    </DialogTrigger>
  );
}
