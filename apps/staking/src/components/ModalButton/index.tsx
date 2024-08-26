"use client";

import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useState,
} from "react";

import { Button } from "../Button";
import { Modal } from "../Modal";

type Props = Omit<
  ComponentProps<typeof Modal>,
  "open" | "onClose" | "additionalButtons"
> & {
  buttonContent?: ReactNode | ReactNode[] | undefined;
  onClose?: () => void;
  additionalButtons?:
    | ((onClose: () => void) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
};

export const ModalButton = ({
  buttonContent,
  title,
  onClose,
  additionalButtons,
  ...props
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
    setIsOpen(false);
  }, [setIsOpen, onClose]);
  const open = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  return (
    <>
      <Button onClick={open}>{buttonContent ?? title}</Button>
      <Modal
        open={isOpen}
        onClose={close}
        title={title}
        additionalButtons={
          typeof additionalButtons === "function"
            ? additionalButtons(close)
            : additionalButtons
        }
        {...props}
      />
    </>
  );
};
