import { type WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import {
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";

import { stringToTokens } from "../../tokens";
import { StateType, useTransfer } from "../../use-transfer";
import { Button } from "../Button";
import type { DashboardLoaded } from "../Dashboard/loaded";
import { Modal } from "../Modal";

type Props = {
  actionName: string;
  actionDescription: string;
  title?: string | undefined;
  submitButtonText?: string | undefined;
  max: bigint;
  replaceData: ComponentProps<typeof DashboardLoaded>["replaceData"];
  children?: ReactNode | ReactNode[] | undefined;
  transfer: (
    connection: Connection,
    wallet: WalletContextState,
    amount: bigint,
  ) => Promise<void>;
};

export const TransferButton = ({
  actionName,
  submitButtonText,
  actionDescription,
  title,
  max,
  replaceData,
  transfer,
  children,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [amountInput, setAmountInput] = useState<string>("");

  const updateAmount = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setAmountInput(event.target.value);
    },
    [setAmountInput],
  );

  const amount = useMemo(() => {
    const amount = stringToTokens(amountInput);
    return amount !== undefined && amount <= max && amount > 0n
      ? amount
      : undefined;
  }, [amountInput, max]);

  const doTransfer = useCallback(
    (connection: Connection, wallet: WalletContextState) =>
      amount === undefined
        ? Promise.reject(new InvalidAmountError())
        : transfer(connection, wallet, amount),
    [amount, transfer],
  );

  const close = useCallback(() => {
    setAmountInput("");
    setIsOpen(false);
  }, [setAmountInput, setIsOpen]);

  const { state, execute } = useTransfer(doTransfer, replaceData, (reset) => {
    close();
    reset();
  });

  const isLoading = useMemo(
    () =>
      state.type === StateType.Submitting ||
      state.type === StateType.LoadingData,
    [state],
  );

  const open = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const closeUnlessLoading = useCallback(() => {
    if (!isLoading) {
      close();
    }
  }, [isLoading, close]);

  return (
    <>
      <Button onClick={open}>{actionName}</Button>
      <Modal
        open={isOpen}
        onClose={closeUnlessLoading}
        closeDisabled={isLoading}
        title={title ?? actionName}
        description={actionDescription}
        additionalButtons={
          <Button
            disabled={amount === undefined}
            onClick={execute}
            loading={isLoading}
          >
            {submitButtonText ?? actionName}
          </Button>
        }
      >
        <input name="amount" value={amountInput} onChange={updateAmount} />
        {children && <div>{children}</div>}
      </Modal>
    </>
  );
};

class InvalidAmountError extends Error {
  override message = "Invalid amount";
}
