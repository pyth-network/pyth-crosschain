import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";

import background from "./background.png";
import { deposit, withdraw, claim } from "../../api";
import { StateType, useTransfer } from "../../hooks/use-transfer";
import { Button } from "../Button";
import { Modal, ModalButton, ModalPanel } from "../Modal";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";

type Props = {
  total: bigint;
  locked: bigint;
  unlockSchedule: {
    amount: bigint;
    date: Date;
  }[];
  lastSlash:
    | {
        amount: bigint;
        date: Date;
      }
    | undefined;
  walletAmount: bigint;
  availableRewards: bigint;
  expiringRewards: {
    amount: bigint;
    expiry: Date;
  };
  availableToWithdraw: bigint;
};

export const AccountSummary = ({
  locked,
  unlockSchedule,
  lastSlash,
  walletAmount,
  total,
  availableToWithdraw,
  availableRewards,
  expiringRewards,
}: Props) => (
  <section className="relative w-full overflow-hidden border border-neutral-600/50 bg-pythpurple-800">
    <Image
      src={background}
      alt=""
      className="absolute -right-40 h-full object-right [mask-image:linear-gradient(to_right,_transparent,_black_50%)]"
    />
    <div className="relative flex flex-col items-start justify-between gap-16 px-12 py-20 md:flex-row md:items-center">
      <div>
        <div className="mb-4 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400">
          Total Balance
        </div>
        <div className="flex flex-row items-center gap-8">
          <span>
            <Tokens className="text-6xl font-light">{total}</Tokens>
          </span>
          {lastSlash && (
            <p className="max-w-48 text-sm text-red-600">
              <Tokens>{lastSlash.amount}</Tokens> were slashed on{" "}
              {lastSlash.date.toLocaleString()}
            </p>
          )}
        </div>
        <div className="mt-8 flex flex-row items-center gap-4">
          <TransferButton
            actionDescription="Add funds to your balance"
            actionName="Deposit"
            max={walletAmount}
            transfer={deposit}
          />
        </div>
        {locked > 0n && (
          <>
            <div className="mt-6 flex flex-row items-center gap-1 text-xl text-pythpurple-100/50">
              <Tokens>{locked}</Tokens>
              <div>locked</div>
            </div>
            <Modal>
              <ModalButton
                as="button"
                className="mt-1 text-sm text-pythpurple-400 hover:underline"
              >
                Show Unlock Schedule
              </ModalButton>
              <ModalPanel
                title="Unlock Schedule"
                description="Your tokens will become available for withdrawal and for participation in Integrity Staking according to this schedule"
              >
                <div className="border border-neutral-600/50 bg-pythpurple-100/10 px-8 py-6">
                  <table>
                    <thead className="font-medium">
                      <tr>
                        <td className="pr-12 text-sm text-neutral-400">Date</td>
                        <td className="text-sm text-neutral-400">Amount</td>
                      </tr>
                    </thead>
                    <tbody>
                      {unlockSchedule.map((unlock, i) => (
                        <tr key={i}>
                          <td className="pr-12 text-sm opacity-80">
                            {unlock.date.toLocaleString()}
                          </td>
                          <td>
                            <Tokens>{unlock.amount}</Tokens>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ModalPanel>
            </Modal>
          </>
        )}
      </div>
      <div className="flex flex-col items-stretch gap-4 xl:flex-row">
        <BalanceCategory
          name="Available for Withdrawal"
          amount={availableToWithdraw}
          description="The lesser of the amount you have available to stake in governance & integrity staking"
          action={
            <TransferButton
              small
              secondary
              actionDescription="Move funds from your account back to your wallet"
              actionName="Withdraw"
              max={availableToWithdraw}
              transfer={withdraw}
              disabled={availableToWithdraw === 0n}
            />
          }
        />
        <BalanceCategory
          name="Available Rewards"
          amount={availableRewards}
          description="Rewards you have earned but not yet claimed from the Integrity Staking program"
          action={<ClaimButton disabled={availableRewards === 0n} />}
          {...(expiringRewards.amount > 0n && {
            warning: (
              <>
                <Tokens>{expiringRewards.amount}</Tokens> will expire on{" "}
                {expiringRewards.expiry.toLocaleDateString()}
              </>
            ),
          })}
        />
      </div>
    </div>
  </section>
);

type BalanceCategoryProps = {
  name: string;
  amount: bigint;
  description: string;
  action: ReactNode;
  warning?: ReactNode | undefined;
};

const BalanceCategory = ({
  name,
  amount,
  description,
  action,
  warning,
}: BalanceCategoryProps) => (
  <div className="flex flex-col justify-between border border-neutral-600/50 bg-pythpurple-800/60 p-6 backdrop-blur">
    <div>
      <div className="mb-4 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400">
        {name}
      </div>
      <div>
        <Tokens className="text-xl font-light">{amount}</Tokens>
      </div>
      <p className="mt-4 max-w-xs text-sm text-neutral-500">{description}</p>
    </div>
    <div className="mt-4 flex flex-row items-center gap-4">
      {action}
      {warning && <p className="max-w-xs text-xs text-red-600">{warning}</p>}
    </div>
  </div>
);

const ClaimButton = (
  props: Omit<
    ComponentProps<typeof Button>,
    "onClick" | "disabled" | "loading"
  >,
) => {
  const { state, execute } = useTransfer(claim);

  return (
    <Button
      small
      secondary
      onClick={execute}
      disabled={state.type !== StateType.Base}
      loading={state.type === StateType.Submitting}
      {...props}
    >
      Claim
    </Button>
  );
};
