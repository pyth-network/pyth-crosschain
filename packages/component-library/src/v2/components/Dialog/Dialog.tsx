import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { PropsWithChildren, ReactNode } from "react";

import { Button } from "../Button";
import { classes } from "./Dialog.styles";

export type DialogProps = PropsWithChildren & {
  onClose: () => void;
  onOpen?: () => void;
  open: boolean;
  saveAction: ReactNode;
  title: ReactNode;
};

export function Dialog({
  children,
  onClose,
  onOpen,
  open,
  saveAction,
  title,
}: DialogProps) {
  return (
    <BaseDialog.Root
      onOpenChange={(open) => {
        if (open) return onOpen?.();
        onClose();
      }}
      open={open}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={classes.backdrop} />
        <BaseDialog.Viewport className={classes.viewport}>
          <BaseDialog.Popup className={classes.popup}>
            <BaseDialog.Title className={classes.title}>
              {title}
            </BaseDialog.Title>
            <BaseDialog.Description
              className={classes.description}
              render={<div />}
            >
              {children}
            </BaseDialog.Description>
            <div className={classes.actions}>
              {saveAction}
              <BaseDialog.Close
                className={classes.close}
                render={<Button variant="outline" />}
              >
                Close
              </BaseDialog.Close>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
