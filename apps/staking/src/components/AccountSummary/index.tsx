import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useLocalStorageValue } from "@react-hookz/web";
import Image from "next/image";
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useCallback,
  useState,
} from "react";
import {
  DialogTrigger,
  Form,
  Button as ReactAriaButton,
} from "react-aria-components";

import background from "./background.png";
import { type States, StateType as ApiStateType } from "../../hooks/use-api";
import { StateType, useAsync } from "../../hooks/use-async";
import { Button, LinkButton } from "../Button";
import { Checkbox } from "../Checkbox";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";
import { Tokens } from "../Tokens";
import { TransferButton, TransferDialog } from "../TransferButton";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
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
  expiringRewards: Date | undefined;
  availableToWithdraw: bigint;
  restrictedMode?: boolean | undefined;
};

export const AccountSummary = ({
  api,
  locked,
  unlockSchedule,
  lastSlash,
  walletAmount,
  total,
  availableToWithdraw,
  availableRewards,
  expiringRewards,
  restrictedMode,
}: Props) => (
  <section className="relative w-full overflow-hidden sm:border sm:border-neutral-600/50 sm:bg-pythpurple-800">
    <Image
      src={background}
      alt=""
      className="absolute -right-40 hidden h-full object-cover object-right [mask-image:linear-gradient(to_right,_transparent,_black_50%)] md:block"
    />
    <div className="relative flex flex-row items-center justify-between gap-8 sm:px-6 sm:py-10 md:gap-16 lg:px-12 lg:py-20">
      <div>
        <div className="mb-2 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400 sm:mb-4">
          Total Balance
        </div>
        <div className="flex flex-row items-center gap-8">
          <span>
            <Tokens className="text-4xl font-light sm:text-6xl">{total}</Tokens>
          </span>
          {lastSlash && (
            <p className="max-w-48 text-sm text-red-600">
              <Tokens>{lastSlash.amount}</Tokens> were slashed on{" "}
              {lastSlash.date.toLocaleString()}
            </p>
          )}
        </div>
        {locked > 0n && (
          <>
            <div className="mt-3 flex flex-row items-center gap-1 text-pythpurple-100/50 sm:mt-6 sm:text-xl">
              <Tokens>{locked}</Tokens>
              <div>locked included</div>
            </div>
            <DialogTrigger>
              <ReactAriaButton className="mt-1 text-sm text-pythpurple-400 hover:underline focus:outline-none focus-visible:underline focus-visible:outline-none">
                Show Unlock Schedule
              </ReactAriaButton>
              <ModalDialog
                title="Unlock Schedule"
                description="Your tokens will become available for withdrawal and for participation in Integrity Staking according to this schedule"
              >
                <div className="border border-neutral-600/50 bg-pythpurple-100/10 p-4 sm:px-8 sm:py-6">
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
                          <td className="pr-12 text-xs opacity-80 sm:text-sm">
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
              </ModalDialog>
            </DialogTrigger>
          </>
        )}
        <div className="mt-3 flex flex-row items-center gap-4 sm:mt-8">
          {!restrictedMode && (
            <AddTokensButton walletAmount={walletAmount} api={api} />
          )}
          {availableToWithdraw === 0n ? (
            <DialogTrigger>
              <Button variant="secondary" className="xl:hidden">
                Withdraw
              </Button>
              <ModalDialog title="No Withdrawable Tokens" closeButtonText="Ok">
                <p className="mb-8 font-semibold">
                  You have no tokens available for withdrawal
                </p>

                <div className="-mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
                  <InformationCircleIcon className="size-8 flex-none" />
                  <div className="text-sm">
                    You can only withdraw tokens that are unlocked and not
                    staked in either OIS or Pyth Governance
                  </div>
                </div>
              </ModalDialog>
            </DialogTrigger>
          ) : (
            <WithdrawButton
              api={api}
              max={availableToWithdraw}
              className="xl:hidden"
            />
          )}
          {!restrictedMode && (
            <DialogTrigger>
              <Button variant="secondary" className="xl:hidden">
                Claim
              </Button>
              {availableRewards === 0n ||
              api.type === ApiStateType.LoadedNoStakeAccount ? (
                <ModalDialog title="No Rewards" closeButtonText="Ok">
                  <p>You have no rewards available to be claimed</p>
                </ModalDialog>
              ) : (
                <ClaimDialog
                  expiringRewards={expiringRewards}
                  availableRewards={availableRewards}
                  api={api}
                />
              )}
            </DialogTrigger>
          )}
        </div>
      </div>
      <div className="hidden w-auto items-stretch gap-4 xl:flex">
        <BalanceCategory
          name="Unlocked & Unstaked"
          amount={availableToWithdraw}
          description="The amount of unlocked tokens that are not staked in either program"
          action={
            <WithdrawButton api={api} max={availableToWithdraw} size="small" />
          }
        />
        {!restrictedMode && (
          <BalanceCategory
            name="Available Rewards"
            amount={availableRewards}
            description="Rewards you have earned from OIS"
            action={
              api.type === ApiStateType.Loaded ? (
                <ClaimButton
                  size="small"
                  variant="secondary"
                  isDisabled={availableRewards === 0n}
                  api={api}
                />
              ) : (
                <Button size="small" variant="secondary" isDisabled={true}>
                  Claim
                </Button>
              )
            }
            {...(expiringRewards !== undefined &&
              availableRewards > 0n && {
                warning: (
                  <>
                    Rewards expire one year from the epoch in which they were
                    earned. You have rewards expiring on{" "}
                    {expiringRewards.toLocaleDateString()}.
                  </>
                ),
              })}
          />
        )}
      </div>
    </div>
  </section>
);

type WithdrawButtonProps = Omit<
  ComponentProps<typeof TransferButton>,
  "variant" | "actionDescription" | "actionName" | "transfer"
> & {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
};

const WithdrawButton = ({ api, ...props }: WithdrawButtonProps) => (
  <TransferButton
    variant="secondary"
    actionDescription="Move funds from your account back to your wallet"
    actionName="Withdraw"
    {...(api.type === ApiStateType.Loaded && {
      transfer: api.withdraw,
    })}
    {...props}
  >
    <div className="mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
      <InformationCircleIcon className="size-8 flex-none" />
      <div className="text-sm">
        You can only withdraw tokens that are unlocked and not staked in either
        OIS or Pyth Governance
      </div>
    </div>
  </TransferButton>
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
  <div className="flex w-full flex-col justify-between border border-neutral-600/50 bg-pythpurple-800/60 p-4 backdrop-blur sm:p-6 xl:w-80 2xl:w-96">
    <div>
      <div className="mb-4 inline-block border border-neutral-600/50 bg-neutral-900 px-4 py-1 text-xs text-neutral-400">
        {name}
      </div>
      <div>
        <Tokens className="text-xl font-light">{amount}</Tokens>
      </div>
      <p className="mt-4 text-sm text-neutral-500">{description}</p>
    </div>
    <div className="mt-4 flex flex-row items-center gap-4">
      {action}
      {warning && <p className="text-xs text-red-600">{warning}</p>}
    </div>
  </div>
);

type ClaimDialogProps = {
  availableRewards: bigint;
  expiringRewards: Date | undefined;
  api: States[ApiStateType.Loaded];
};

const ClaimDialog = ({
  api,
  expiringRewards,
  availableRewards,
}: ClaimDialogProps) => {
  const { state, execute } = useAsync(api.claim);

  const doClaim = useCallback(() => {
    execute().catch(() => {
      /* TODO figure out a better UI treatment for when claim fails */
    });
  }, [execute]);

  return (
    <ModalDialog title="Claim">
      {({ close }) => (
        <>
          <p className="mb-4">
            Claim your <Tokens>{availableRewards}</Tokens> rewards
          </p>
          {expiringRewards && (
            <div className="mb-4 flex max-w-96 flex-row gap-2 border border-neutral-600/50 bg-pythpurple-400/20 p-4">
              <InformationCircleIcon className="size-8 flex-none" />
              <div className="text-sm">
                Rewards expire one year from the epoch in which they were
                earned. You have rewards expiring on{" "}
                {expiringRewards.toLocaleDateString()}.
              </div>
            </div>
          )}
          {state.type === StateType.Error && (
            <p className="mt-8 text-red-600">
              Uh oh, an error occurred! Please try again
            </p>
          )}
          <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              size="noshrink"
              onPress={close}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              size="noshrink"
              isLoading={state.type === StateType.Running}
              onPress={doClaim}
            >
              Claim
            </Button>
          </div>
        </>
      )}
    </ModalDialog>
  );
};

type ClaimButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "disabled" | "loading"
> & {
  api: States[ApiStateType.Loaded];
};

const ClaimButton = ({ api, ...props }: ClaimButtonProps) => {
  const { state, execute } = useAsync(api.claim);

  const doClaim = useCallback(() => {
    execute().catch(() => {
      /* TODO figure out a better UI treatment for when claim fails */
    });
  }, [execute]);

  return (
    <Button
      onPress={doClaim}
      isDisabled={state.type !== StateType.Base}
      isLoading={state.type === StateType.Running}
      {...props}
    >
      Claim
    </Button>
  );
};

type AddTokensButtonProps = {
  walletAmount: bigint;
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
};

const AddTokensButton = ({ walletAmount, api }: AddTokensButtonProps) => {
  const hasAcknowledgedLegal = useLocalStorageValue("has-acknowledged-legal");
  const [transferOpen, setTransferOpen] = useState(false);
  const openTransfer = useCallback(() => {
    setTransferOpen(true);
  }, [setTransferOpen]);
  const acknowledgeLegal = useCallback(() => {
    hasAcknowledgedLegal.set("true");
    openTransfer();
  }, [hasAcknowledgedLegal, openTransfer]);

  return (
    <>
      {hasAcknowledgedLegal.value ? (
        <Button onPress={openTransfer}>Add Tokens</Button>
      ) : (
        <DisclosureButton onAcknowledge={acknowledgeLegal} />
      )}
      <TransferDialog
        title="Add tokens"
        description="Add funds to your balance"
        max={walletAmount}
        transfer={api.deposit}
        submitButtonText="Add tokens"
        isOpen={transferOpen}
        onOpenChange={setTransferOpen}
      />
    </>
  );
};

type DisclosureButtonProps = {
  onAcknowledge: () => void;
};

const DisclosureButton = ({ onAcknowledge }: DisclosureButtonProps) => {
  const [understood, setUnderstood] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);
  const acknowledge = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setOpen(false);
      setTimeout(onAcknowledge, 400);
    },
    [setOpen, onAcknowledge],
  );

  return (
    <>
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <Button>Add Tokens</Button>
        <ModalDialog title="Disclosure">
          <Form onSubmit={acknowledge}>
            <p className="max-w-prose text-sm opacity-60">
              THE SERVICES WERE NOT DEVELOPED FOR, AND ARE NOT AVAILABLE TO
              PERSONS OR ENTITIES WHO RESIDE IN, ARE LOCATED IN, ARE
              INCORPORATED IN, OR HAVE A REGISTERED OFFICE OR PRINCIPAL PLACE OF
              BUSINESS IN THE UNITED STATES OF AMERICA, THE UNITED KINGDOM OR
              CANADA (COLLECTIVELY, “BLOCKED PERSONS”). MOREOVER, THE SERVICES
              ARE NOT OFFERED TO PERSONS OR ENTITIES WHO RESIDE IN, ARE CITIZENS
              OF, ARE LOCATED IN, ARE INCORPORATED IN, OR HAVE A REGISTERED
              OFFICE OR PRINCIPAL PLACE OF BUSINESS IN ANY RESTRICTED
              JURISDICTION OR COUNTRY SUBJECT TO ANY SANCTIONS OR RESTRICTIONS
              PURSUANT TO ANY APPLICABLE LAW, INCLUDING THE CRIMEA REGION, CUBA,
              IRAN, NORTH KOREA, SYRIA, MYANMAR (BURMA, DONETSK, LUHANSK, OR ANY
              OTHER COUNTRY TO WHICH THE UNITED STATES, THE UNITED KINGDOM, THE
              EUROPEAN UNION OR ANY OTHER JURISDICTIONS EMBARGOES GOODS OR
              IMPOSES SIMILAR SANCTIONS, INCLUDING THOSE LISTED ON OUR SERVICES
              (COLLECTIVELY, THE “RESTRICTED JURISDICTIONS” AND EACH A
              “RESTRICTED JURISDICTION”) OR ANY PERSON OWNED, CONTROLLED,
              LOCATED IN OR ORGANIZED UNDER THE LAWS OF ANY JURISDICTION UNDER
              EMBARGO OR CONNECTED OR AFFILIATED WITH ANY SUCH PERSON
              (COLLECTIVELY, “RESTRICTED PERSONS”). THE WEBSITE WAS NOT
              SPECIFICALLY DEVELOPED FOR, AND IS NOT AIMED AT OR BEING ACTIVELY
              MARKETED TO, PERSONS OR ENTITIES WHO RESIDE IN, ARE LOCATED IN,
              ARE INCORPORATED IN, OR HAVE A REGISTERED OFFICE OR PRINCIPAL
              PLACE OF BUSINESS IN THE EUROPEAN UNION. THERE ARE NO EXCEPTIONS.
              IF YOU ARE A BLOCKED PERSON OR A RESTRICTED PERSON, THEN DO NOT
              USE OR ATTEMPT TO USE THE SERVICES. USE OF ANY TECHNOLOGY OR
              MECHANISM, SUCH AS A VIRTUAL PRIVATE NETWORK (“VPN”) TO CIRCUMVENT
              THE RESTRICTIONS SET FORTH HEREIN IS PROHIBITED.
            </p>
            <Checkbox
              className="my-4 block max-w-prose"
              isSelected={understood}
              onChange={setUnderstood}
            >
              I understand
            </Checkbox>
            <Checkbox
              className="my-4 block max-w-prose"
              isSelected={agreed}
              onChange={setAgreed}
            >
              By checking the box and access the Services, you acknowledge and
              agree to the terms and conditions of our{" "}
              <Link
                href="https://www.pyth.network/terms-of-use"
                target="_blank"
                className="underline"
              >
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link
                href="https://www.pyth.network/privacy-policy"
                target="_blank"
                className="underline"
              >
                Privacy Policy
              </Link>
              .
            </Checkbox>
            <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
              <LinkButton
                className="w-full sm:w-auto"
                href="https://pyth.network/"
                variant="secondary"
                size="noshrink"
              >
                Exit
              </LinkButton>
              <Button
                className="w-full sm:w-auto"
                size="noshrink"
                type="submit"
                isDisabled={!understood || !agreed}
              >
                Confirm
              </Button>
            </div>
          </Form>
        </ModalDialog>
      </DialogTrigger>
    </>
  );
};
