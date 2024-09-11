"use client";

import {
  WalletIcon,
  ArrowsRightLeftIcon,
  XCircleIcon,
  ChevronDownIcon,
  TableCellsIcon,
  BanknotesIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  type ComponentProps,
  type ComponentType,
  type SVGAttributes,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
  Section,
  SubmenuTrigger,
} from "react-aria-components";

import { BLOCKED_SEGMENT } from "../../config/isomorphic";
import {
  StateType as ApiStateType,
  type States,
  useApi,
} from "../../hooks/use-api";
import { useLogger } from "../../hooks/use-logger";
import { usePrimaryDomain } from "../../hooks/use-primary-domain";
import { AccountHistory } from "../AccountHistory";
import { Button } from "../Button";
import { ModalDialog } from "../ModalDialog";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export const WalletButton = (props: Props) => {
  const segment = useSelectedLayoutSegment();
  // eslint-disable-next-line unicorn/no-null
  return segment === BLOCKED_SEGMENT ? null : <WalletButtonImpl {...props} />;
};

const WalletButtonImpl = (props: Props) => {
  const api = useApi();

  switch (api.type) {
    case ApiStateType.NotLoaded:
    case ApiStateType.NoWallet: {
      return <DisconnectedButton {...props} />;
    }

    case ApiStateType.ErrorLoadingStakeAccounts:
    case ApiStateType.Loaded:
    case ApiStateType.LoadedNoStakeAccount:
    case ApiStateType.LoadingStakeAccounts: {
      return <ConnectedButton {...props} api={api} />;
    }
  }
};

type ConnectedButtonProps = Props & {
  api:
    | States[ApiStateType.ErrorLoadingStakeAccounts]
    | States[ApiStateType.Loaded]
    | States[ApiStateType.LoadedNoStakeAccount]
    | States[ApiStateType.LoadingStakeAccounts];
};

const ConnectedButton = ({
  className,
  api,
  ...props
}: ConnectedButtonProps) => {
  const [accountHistoryOpen, setAccountHistoryOpen] = useState(false);
  const openAccountHistory = useCallback(() => {
    setAccountHistoryOpen(true);
  }, [setAccountHistoryOpen]);
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);
  const logger = useLogger();
  const wallet = useWallet();
  const disconnectWallet = useCallback(() => {
    wallet.disconnect().catch((error: unknown) => {
      logger.error(error);
    });
  }, [wallet, logger]);

  return (
    <>
      <MenuTrigger>
        <ButtonComponent
          className={clsx(
            "group data-[pressed]:bg-pythpurple-600/60",
            className,
          )}
          {...props}
        >
          <span className="truncate">
            <ButtonContent />
          </span>
          <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
        </ButtonComponent>
        <StyledMenu className="min-w-[var(--trigger-width)]">
          {api.type === ApiStateType.Loaded && (
            <>
              <Section className="flex w-full flex-col">
                <SubmenuTrigger>
                  <WalletMenuItem
                    icon={BanknotesIcon}
                    textValue="Select stake account"
                  >
                    <span>Select stake account</span>
                    <ChevronRightIcon className="size-4" />
                  </WalletMenuItem>
                  <StyledMenu
                    items={api.allAccounts.map((account) => ({
                      account,
                      id: account.address.toBase58(),
                    }))}
                  >
                    {(item) => (
                      <WalletMenuItem
                        onAction={() => {
                          api.selectAccount(item.account);
                        }}
                        className={clsx({
                          "font-semibold": item.account === api.account,
                        })}
                        isDisabled={item.account === api.account}
                      >
                        <CheckIcon
                          className={clsx("size-4 text-pythpurple-600", {
                            invisible: item.account !== api.account,
                          })}
                        />
                        <pre>
                          <TruncatedKey>{item.account.address}</TruncatedKey>
                        </pre>
                      </WalletMenuItem>
                    )}
                  </StyledMenu>
                </SubmenuTrigger>
                <WalletMenuItem
                  onAction={openAccountHistory}
                  icon={TableCellsIcon}
                >
                  Account history
                </WalletMenuItem>
              </Section>
              <Separator className="mx-2 my-1 h-px bg-black/20" />
            </>
          )}
          <Section className="flex w-full flex-col">
            <WalletMenuItem onAction={showModal} icon={ArrowsRightLeftIcon}>
              Change wallet
            </WalletMenuItem>
            <WalletMenuItem onAction={disconnectWallet} icon={XCircleIcon}>
              Disconnect
            </WalletMenuItem>
          </Section>
        </StyledMenu>
      </MenuTrigger>
      {api.type === ApiStateType.Loaded && (
        <ModalDialog
          isOpen={accountHistoryOpen}
          onOpenChange={setAccountHistoryOpen}
          title="Account history"
          description="A history of events that have affected your account balances"
        >
          <AccountHistory api={api} />
        </ModalDialog>
      )}
    </>
  );
};

const StyledMenu = <T extends object>({
  className,
  ...props
}: ComponentProps<typeof Menu<T>>) => (
  <Popover className="data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out focus:outline-none focus-visible:outline-none focus-visible:ring-0">
    <Menu
      className={clsx(
        "flex origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  </Popover>
);

const ButtonContent = () => {
  const wallet = useWallet();
  const primaryDomain = usePrimaryDomain();

  if (primaryDomain) {
    return primaryDomain;
  } else if (wallet.publicKey) {
    return <TruncatedKey>{wallet.publicKey}</TruncatedKey>;
  } else if (wallet.connecting) {
    return "Connecting...";
  } else {
    return "Connect";
  }
};

const TruncatedKey = ({ children }: { children: PublicKey | `0x${string}` }) =>
  useMemo(() => {
    const isHex = typeof children === "string";
    const asString = isHex ? children : children.toBase58();
    return asString.slice(0, isHex ? 6 : 4) + ".." + asString.slice(-4);
  }, [children]);

type WalletMenuItemProps = Omit<ComponentProps<typeof MenuItem>, "children"> & {
  icon?: ComponentType<SVGAttributes<SVGSVGElement>>;
  children: ReactNode;
};

const WalletMenuItem = ({
  children,
  icon: Icon,
  className,
  textValue,
  ...props
}: WalletMenuItemProps) => (
  <MenuItem
    textValue={textValue ?? (typeof children === "string" ? children : "")}
    className={clsx(
      "flex cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2 text-left data-[disabled]:cursor-default data-[focused]:bg-pythpurple-800/20 data-[has-submenu]:data-[open]:bg-pythpurple-800/10 data-[has-submenu]:data-[open]:data-[focused]:bg-pythpurple-800/20 focus:outline-none focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-4 text-pythpurple-600" />}
    {children}
  </MenuItem>
);

const DisconnectedButton = (props: Props) => {
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);

  return (
    <ButtonComponent onPress={showModal} {...props}>
      <span>Connect wallet</span>
    </ButtonComponent>
  );
};

type ButtonComponentProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode | ReactNode[];
};

const ButtonComponent = ({
  className,
  children,
  ...props
}: ButtonComponentProps) => (
  <Button
    className={clsx(
      "flex w-36 flex-row items-center justify-center gap-2 text-sm sm:w-52 sm:text-base",
      className,
    )}
    {...props}
  >
    <WalletIcon className="size-4 flex-none opacity-60" />
    {children}
  </Button>
);
