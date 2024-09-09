import { Field, Input, Label } from "@headlessui/react";
import type { PythStakingClient } from "@pythnetwork/staking-sdk";
import type { PublicKey } from "@solana/web3.js";
import {
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";

import { useLogger } from "../../hooks/use-logger";
import { StateType, useTransfer } from "../../hooks/use-transfer";
import { stringToTokens, tokensToString } from "../../tokens";
import { Button } from "../Button";
import { Modal, ModalButton, ModalPanel } from "../Modal";
import { Tokens } from "../Tokens";
import PythTokensIcon from "../Tokens/pyth.svg";

type Props = {
  actionName: string;
  actionDescription: string;
  title?: string | undefined;
  submitButtonText?: string | undefined;
  max: bigint;
  children?:
    | ((amount: Amount) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
  transfer: (
    client: PythStakingClient,
    stakingAccount: PublicKey,
    amount: bigint,
  ) => Promise<void>;
  className?: string | undefined;
  secondary?: boolean | undefined;
  small?: boolean | undefined;
  disabled?: boolean | undefined;
};

export const TransferButton = ({
  actionName,
  submitButtonText,
  actionDescription,
  title,
  max,
  transfer,
  children,
  className,
  secondary,
  small,
  disabled,
}: Props) => {
  const { amountInput, setAmount, updateAmount, resetAmount, amount } =
    useAmountInput(max);
  const doTransfer = useCallback(
    (client: PythStakingClient, stakingAccount: PublicKey) =>
      amount.type === AmountType.Valid
        ? transfer(client, stakingAccount, amount.amount)
        : Promise.reject(new InvalidAmountError()),
    [amount, transfer],
  );
  const setMax = useCallback(() => {
    setAmount(tokensToString(max));
  }, [setAmount, max]);

  const { state, execute } = useTransfer(doTransfer);
  const isSubmitting = state.type === StateType.Submitting;

  return (
    <Modal>
      <ModalButton
        className={className}
        secondary={secondary}
        small={small}
        disabled={disabled}
      >
        {actionName}
      </ModalButton>
      <ModalPanel
        title={title ?? actionName}
        closeDisabled={isSubmitting}
        description={actionDescription}
        afterLeave={resetAmount}
      >
        {(close) => (
          <>
            <Field className="mb-8 flex w-full flex-col gap-1 sm:min-w-96">
              <div className="flex flex-row items-center justify-between">
                <Label className="text-sm">Amount</Label>
                <div className="flex flex-row items-center gap-2">
                  <Tokens>{max}</Tokens>
                  <span className="text-xs opacity-60">Max</span>
                </div>
              </div>
              <div className="relative w-full">
                <Input
                  name="amount"
                  className="w-full truncate border border-neutral-600/50 bg-transparent py-3 pl-12 pr-24 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
                  value={amountInput}
                  onChange={updateAmount}
                  placeholder="0.00"
                />
                <div className="pointer-events-none absolute inset-y-0 flex w-full items-center justify-between px-4">
                  <PythTokensIcon className="size-6" />
                  <Button
                    small
                    secondary
                    className="pointer-events-auto"
                    onClick={setMax}
                    disabled={isSubmitting}
                  >
                    max
                  </Button>
                </div>
              </div>
              {state.type === StateType.Error && (
                <p className="mt-1 text-red-600">
                  Uh oh, an error occurred! Please try again
                </p>
              )}
            </Field>
            {children && (
              <>
                {typeof children === "function" ? children(amount) : children}
              </>
            )}
            <ExecuteButton
              amount={amount}
              execute={execute}
              loading={isSubmitting}
              close={close}
              className="mt-6 w-full"
            >
              {submitButtonText ?? actionName}
            </ExecuteButton>
          </>
        )}
      </ModalPanel>
    </Modal>
  );
};

type ExecuteButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "disabled" | "children"
> & {
  children: ReactNode | ReactNode[];
  amount: Amount;
  execute: () => Promise<void>;
  close: () => void;
};

const ExecuteButton = ({
  amount,
  execute,
  close,
  children,
  ...props
}: ExecuteButtonProps) => {
  const logger = useLogger();
  const handleClick = useCallback(async () => {
    try {
      await execute();
      close();
    } catch (error: unknown) {
      logger.error(error);
    }
  }, [execute, close, logger]);
  const contents = useMemo(() => {
    switch (amount.type) {
      case AmountType.Empty: {
        return "Enter an amount";
      }
      case AmountType.AboveMax: {
        return "Amount exceeds maximum";
      }
      case AmountType.NotPositive: {
        return "Amount must be greater than zero";
      }
      case AmountType.Invalid: {
        return "Enter a valid amount";
      }
      case AmountType.Valid: {
        return children;
      }
    }
  }, [amount, children]);

  return (
    <Button
      disabled={amount.type !== AmountType.Valid}
      onClick={handleClick}
      {...props}
    >
      {contents}
    </Button>
  );
};

const useAmountInput = (max: bigint) => {
  const [amountInput, setAmountInput] = useState<string>("");

  return {
    amountInput,

    setAmount: setAmountInput,

    updateAmount: useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        setAmountInput(event.target.value);
      },
      [setAmountInput],
    ),

    resetAmount: useCallback(() => {
      setAmountInput("");
    }, [setAmountInput]),

    amount: useMemo((): Amount => {
      if (amountInput === "") {
        return Amount.Empty();
      } else {
        const amountAsTokens = stringToTokens(amountInput);
        if (amountAsTokens === undefined) {
          return Amount.Invalid();
        } else if (amountAsTokens > max) {
          return Amount.AboveMax(amountAsTokens);
        } else if (amountAsTokens <= 0) {
          return Amount.NotPositive(amountAsTokens);
        } else {
          return Amount.Valid(amountAsTokens);
        }
      }
    }, [amountInput, max]),
  };
};

export enum AmountType {
  Empty,
  NotPositive,
  Valid,
  Invalid,
  AboveMax,
}

const Amount = {
  Empty: () => ({ type: AmountType.Empty as const }),
  NotPositive: (amount: bigint) => ({
    type: AmountType.NotPositive as const,
    amount,
  }),
  Valid: (amount: bigint) => ({ type: AmountType.Valid as const, amount }),
  Invalid: () => ({ type: AmountType.Invalid as const }),
  AboveMax: (amount: bigint) => ({
    type: AmountType.AboveMax as const,
    amount,
  }),
};

type Amount = ReturnType<(typeof Amount)[keyof typeof Amount]>;

class InvalidAmountError extends Error {
  constructor() {
    super("Invalid amount");
  }
}
