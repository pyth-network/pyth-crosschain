import type { PythStakingClient } from "@pythnetwork/staking-sdk";
import type { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
  type ReactNode,
  type FormEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  DialogTrigger,
  TextField,
  Label,
  Input,
  Form,
  Group,
} from "react-aria-components";

import { StateType, useTransfer } from "../../hooks/use-transfer";
import { stringToTokens, tokensToString } from "../../tokens";
import { Button } from "../Button";
import { ModalDialog } from "../ModalDialog";
import { Tokens } from "../Tokens";
import PythTokensIcon from "../Tokens/pyth.svg";

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
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
};

export const TransferButton = ({
  actionName,
  submitButtonText,
  actionDescription,
  title,
  max,
  transfer,
  children,
  ...props
}: Props) => {
  const [closeDisabled, setCloseDisabled] = useState(false);

  return (
    <DialogTrigger>
      <Button {...props}>{actionName}</Button>
      <ModalDialog
        title={title ?? actionName}
        closeDisabled={closeDisabled}
        description={actionDescription}
      >
        {({ close }) => (
          <DialogContents
            max={max}
            transfer={transfer}
            setCloseDisabled={setCloseDisabled}
            submitButtonText={submitButtonText ?? actionName}
            close={close}
          >
            {children}
          </DialogContents>
        )}
      </ModalDialog>
    </DialogTrigger>
  );
};

type DialogContentsProps = {
  max: bigint;
  children: Props["children"];
  transfer: Props["transfer"];
  setCloseDisabled: (value: boolean) => void;
  submitButtonText: string;
  close: () => void;
};

const DialogContents = ({
  max,
  transfer,
  children,
  submitButtonText,
  setCloseDisabled,
  close,
}: DialogContentsProps) => {
  const { amount, setAmount, setMax, stringValue } = useAmountInput(max);

  const validationError = useMemo(() => {
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
        return;
      }
    }
  }, [amount]);

  const doTransfer = useCallback(
    (client: PythStakingClient, stakingAccount: PublicKey) =>
      amount.type === AmountType.Valid
        ? transfer(client, stakingAccount, amount.amount)
        : Promise.reject(new InvalidAmountError()),
    [amount, transfer],
  );

  const { execute, state } = useTransfer(doTransfer);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCloseDisabled(true);
      execute()
        .then(() => {
          close();
        })
        .catch(() => {
          /* no-op since this is already handled in the UI using `state` and is logged in useTransfer */
        })
        .finally(() => {
          setCloseDisabled(false);
        });
    },
    [execute, close, setCloseDisabled],
  );

  return (
    <Form onSubmit={handleSubmit}>
      <TextField
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        isInvalid={validationError !== undefined}
        value={stringValue}
        onChange={setAmount}
        validationBehavior="aria"
        name="amount"
        className="mb-8 flex w-full flex-col gap-1 sm:min-w-96"
      >
        <div className="flex flex-row items-center justify-between">
          <Label className="text-sm">Amount</Label>
          <div className="flex flex-row items-center gap-2">
            <Tokens>{max}</Tokens>
            <span className="text-xs opacity-60">Max</span>
          </div>
        </div>
        <Group className="relative w-full">
          <Input
            className="focused:outline-none focused:ring-0 focused:border-pythpurple-400 w-full truncate border border-neutral-600/50 bg-transparent py-3 pl-12 pr-24 focus:border-pythpurple-400 focus:outline-none focus:ring-0 focus-visible:border-pythpurple-400 focus-visible:outline-none focus-visible:ring-0"
            placeholder="0.00"
          />
          <div className="pointer-events-none absolute inset-y-0 flex w-full items-center justify-between px-4">
            <PythTokensIcon className="size-6" />
            <Button
              size="small"
              variant="secondary"
              className="pointer-events-auto"
              onPress={setMax}
              isDisabled={state.type === StateType.Submitting}
            >
              max
            </Button>
          </div>
        </Group>
        {state.type === StateType.Error && (
          <p className="mt-1 text-red-600">
            Uh oh, an error occurred! Please try again
          </p>
        )}
      </TextField>
      {children && (
        <>{typeof children === "function" ? children(amount) : children}</>
      )}
      <Button
        className="mt-6 w-full"
        type="submit"
        isLoading={state.type === StateType.Submitting}
        isDisabled={amount.type !== AmountType.Valid}
      >
        {validationError ?? submitButtonText}
      </Button>
    </Form>
  );
};

const useAmountInput = (max: bigint) => {
  const [stringValue, setAmount] = useState<string>("");

  return {
    stringValue,

    setAmount,

    setMax: useCallback(() => {
      setAmount(tokensToString(max));
    }, [setAmount, max]),

    amount: useMemo((): Amount => {
      if (stringValue === "") {
        return Amount.Empty();
      } else {
        const amountAsTokens = stringToTokens(stringValue);
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
    }, [stringValue, max]),
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
