import type { ComponentProps, ReactNode, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  DialogTrigger,
  TextField,
  Label,
  Input,
  Form,
  Group,
} from "react-aria-components";

import { StateType, useAsync } from "../../hooks/use-async";
import { useToast } from "../../hooks/use-toast";
import { stringToTokens, tokensToString } from "../../tokens";
import { Button } from "../Button";
import { ErrorMessage } from "../ErrorMessage";
import { ModalDialog } from "../ModalDialog";
import { Tokens } from "../Tokens";
import PythTokensIcon from "../Tokens/pyth.svg";

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
  enableWithZeroMax?: boolean | undefined;
  actionName: ReactNode;
  actionDescription: ReactNode;
  title?: ReactNode | undefined;
  submitButtonText?: ReactNode | undefined;
  max: bigint;
  children?:
    | ((amount: Amount) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
  transfer?: ((amount: bigint) => Promise<void>) | undefined;
  successMessage: ReactNode;
};

export const TransferButton = ({
  enableWithZeroMax,
  actionName,
  submitButtonText,
  actionDescription,
  title,
  max,
  transfer,
  children,
  isDisabled,
  successMessage,
  ...props
}: Props) => {
  return transfer === undefined ||
    isDisabled === true ||
    (max === 0n && !enableWithZeroMax) ? (
    <Button isDisabled={true} {...props}>
      {actionName}
    </Button>
  ) : (
    <DialogTrigger>
      <Button {...props}>{actionName}</Button>
      <TransferDialog
        title={title ?? actionName}
        description={actionDescription}
        max={max}
        transfer={transfer}
        submitButtonText={submitButtonText ?? actionName}
        successMessage={successMessage}
      >
        {children}
      </TransferDialog>
    </DialogTrigger>
  );
};

type TransferDialogProps = Omit<
  ComponentProps<typeof ModalDialog>,
  "children"
> & {
  max: bigint;
  transfer: (amount: bigint) => Promise<void>;
  submitButtonText: ReactNode;
  children?:
    | ((amount: Amount) => ReactNode | ReactNode[])
    | ReactNode
    | ReactNode[]
    | undefined;
  successMessage: ReactNode;
};

const TransferDialog = ({
  max,
  transfer,
  submitButtonText,
  children,
  successMessage,
  ...props
}: TransferDialogProps) => {
  const [closeDisabled, setCloseDisabled] = useState(false);

  return (
    <ModalDialog closeDisabled={closeDisabled} {...props}>
      {({ close }) => (
        <DialogContents
          max={max}
          transfer={transfer}
          setCloseDisabled={setCloseDisabled}
          submitButtonText={submitButtonText}
          close={close}
          successMessage={successMessage}
        >
          {children}
        </DialogContents>
      )}
    </ModalDialog>
  );
};

type DialogContentsProps = {
  max: bigint;
  children: Props["children"];
  transfer: (amount: bigint) => Promise<void>;
  setCloseDisabled: (value: boolean) => void;
  submitButtonText: ReactNode;
  close: () => void;
  successMessage: ReactNode;
};

const DialogContents = ({
  max,
  transfer,
  children,
  submitButtonText,
  setCloseDisabled,
  close,
  successMessage,
}: DialogContentsProps) => {
  const { amount, setAmount, setMax, stringValue } = useAmountInput(max);
  const toast = useToast();

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
    () =>
      amount.type === AmountType.Valid
        ? transfer(amount.amount)
        : Promise.reject(new InvalidAmountError()),
    [amount, transfer],
  );

  const { execute, state } = useAsync(doTransfer);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCloseDisabled(true);
      execute()
        .then(() => {
          close();
          toast.success(successMessage);
        })
        .catch(() => {
          /* no-op since this is already handled in the UI using `state` and is logged in useAsync */
        })
        .finally(() => {
          setCloseDisabled(false);
        });
    },
    [execute, close, setCloseDisabled, toast, successMessage],
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
            required
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
              isDisabled={state.type === StateType.Running}
            >
              max
            </Button>
          </div>
        </Group>
        {state.type === StateType.Error && (
          <div className="mt-4 max-w-sm">
            <ErrorMessage error={state.error} />
          </div>
        )}
      </TextField>
      {children && (
        <>{typeof children === "function" ? children(amount) : children}</>
      )}
      <Button
        className="mt-6 w-full"
        type="submit"
        isLoading={state.type === StateType.Running}
        isDisabled={
          amount.type !== AmountType.Valid || state.type === StateType.Complete
        }
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
