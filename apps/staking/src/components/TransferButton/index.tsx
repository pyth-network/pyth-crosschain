import {
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";

import { useLogger } from "../../logger";
import { stringToTokens } from "../../tokens";
import { type Context } from "../../use-api-context";
import { StateType, useTransfer } from "../../use-transfer";
import { Button } from "../Button";
import { ModalButton } from "../ModalButton";

type Props = {
  actionName: string;
  actionDescription: string;
  title?: string | undefined;
  submitButtonText?: string | undefined;
  max: bigint;
  children?:
    | ((amount: bigint | undefined) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
  transfer: (context: Context, amount: bigint) => Promise<void>;
};

export const TransferButton = ({
  actionName,
  submitButtonText,
  actionDescription,
  title,
  max,
  transfer,
  children,
}: Props) => {
  const { amountInput, updateAmount, resetAmount, amount } =
    useAmountInput(max);
  const doTransfer = useCallback(
    (context: Context) =>
      amount === undefined
        ? Promise.reject(new InvalidAmountError())
        : transfer(context, amount),
    [amount, transfer],
  );

  const { state, execute } = useTransfer(doTransfer);
  const isSubmitting = state.type === StateType.Submitting;

  return (
    <ModalButton
      title={title ?? actionName}
      buttonContent={actionName}
      closeDisabled={isSubmitting}
      description={actionDescription}
      afterLeave={resetAmount}
      additionalButtons={(close) => (
        <ExecuteButton
          disabled={amount === undefined}
          execute={execute}
          loading={isSubmitting}
          close={close}
        >
          {submitButtonText ?? actionName}
        </ExecuteButton>
      )}
    >
      <input name="amount" value={amountInput} onChange={updateAmount} />
      {children && (
        <div>
          {typeof children === "function" ? children(amount) : children}
        </div>
      )}
      {state.type === StateType.Error && <p>Uh oh, an error occurred!</p>}
    </ModalButton>
  );
};

const useAmountInput = (max: bigint) => {
  const [amountInput, setAmountInput] = useState<string>("");

  return {
    amountInput,

    updateAmount: useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        setAmountInput(event.target.value);
      },
      [setAmountInput],
    ),
    resetAmount: useCallback(() => {
      setAmountInput("");
    }, [setAmountInput]),

    amount: useMemo(() => {
      const amountAsTokens = stringToTokens(amountInput);
      return amountAsTokens !== undefined &&
        amountAsTokens <= max &&
        amountAsTokens > 0n
        ? amountAsTokens
        : undefined;
    }, [amountInput, max]),
  };
};

class InvalidAmountError extends Error {
  constructor() {
    super("Invalid amount");
  }
}

type ExecuteButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  execute: () => Promise<void>;
  close: () => void;
};

const ExecuteButton = ({ execute, close, ...props }: ExecuteButtonProps) => {
  const logger = useLogger();
  const handleClick = useCallback(async () => {
    try {
      await execute();
      close();
    } catch (error: unknown) {
      logger.error(error);
    }
  }, [execute, close, logger]);

  return <Button onClick={handleClick} {...props} />;
};
