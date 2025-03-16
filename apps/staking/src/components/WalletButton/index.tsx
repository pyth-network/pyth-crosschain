"use client";

import {
  WalletIcon,
  ArrowsRightLeftIcon,
  XCircleIcon,
  ChevronDownIcon,
  BanknotesIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps, ReactNode, ReactElement } from "react";
import { useCallback, useMemo } from "react";
import {
  MenuTrigger,
  SubmenuTrigger,
  Header,
  Collection,
  MenuItem as BaseMenuItem,
} from "react-aria-components";

import { VPN_BLOCKED_SEGMENT } from "../../config/isomorphic";
import type { States } from "../../hooks/use-api";
import { StateType as ApiStateType, useApi } from "../../hooks/use-api";
import { StateType as DataStateType, useData } from "../../hooks/use-data";
import { useLogger } from "../../hooks/use-logger";
import { useNetwork } from "../../hooks/use-network";
import { usePrimaryDomain } from "../../hooks/use-primary-domain";
import { Button } from "../Button";
import { Menu, MenuItem, Section, Separator } from "../Menu";
import { Switch } from "../Switch";
import { TruncatedKey } from "../TruncatedKey";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export const WalletButton = (props: Props) => {
  const segment = useSelectedLayoutSegment();
  const isBlocked = segment === VPN_BLOCKED_SEGMENT;

  // eslint-disable-next-line unicorn/no-null
  return isBlocked ? null : <WalletButtonImpl {...props} />;
};

const WalletButtonImpl = (props: Props) => {
  const api = useApi();

  switch (api.type) {
    case ApiStateType.WalletDisconnecting:
    case ApiStateType.WalletConnecting: {
      return (
        <ButtonComponent isLoading={true} {...props}>
          Loading...
        </ButtonComponent>
      );
    }

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
  const { isMainnet, toggleMainnet } = useNetwork();

  return (
    <MenuTrigger>
      <ButtonComponent
        className={clsx("group data-[pressed]:bg-pythpurple-600/60", className)}
        {...props}
      >
        <span className="truncate">
          <ButtonContent />
        </span>
        <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
      </ButtonComponent>
      <Menu className="min-w-[var(--trigger-width)]">
        {api.type === ApiStateType.Loaded && (
          <>
            <Section>
              <StakeAccountSelector api={api}>
                <MenuItem icon={BanknotesIcon} textValue="Select stake account">
                  <span>Select stake account</span>
                  <ChevronRightIcon className="size-4" />
                </MenuItem>
              </StakeAccountSelector>
            </Section>
          </>
        )}
        <Section>
          <MenuItem onAction={showModal} icon={ArrowsRightLeftIcon}>
            Change wallet
          </MenuItem>
          <MenuItem onAction={disconnectWallet} icon={XCircleIcon}>
            Disconnect
          </MenuItem>
        </Section>
        <Separator />
        <Section>
          <BaseMenuItem
            className="outline-none data-[focused]:bg-pythpurple-800/20"
            onAction={toggleMainnet}
          >
            <Switch
              isSelected={isMainnet}
              postLabel="Mainnet"
              className="px-4 py-1"
              size="small"
            />
          </BaseMenuItem>
        </Section>
      </Menu>
    </MenuTrigger>
  );
};

type StakeAccountSelectorProps = {
  api: States[ApiStateType.Loaded];
  children: ReactElement;
};

const StakeAccountSelector = ({ children, api }: StakeAccountSelectorProps) => {
  const data = useData(api.dashboardDataCacheKey, api.loadData, {
    refreshInterval: REFRESH_INTERVAL,
  });
  const accounts = useMemo(() => {
    if (data.type === DataStateType.Loaded) {
      const main = api.allAccounts.find((account) =>
        data.data.integrityStakingPublishers.some((publisher) =>
          publisher.stakeAccount?.equals(account),
        ),
      );
      const other = api.allAccounts
        .filter((account) => account !== main)
        .map((account) => ({
          account,
          id: account.toBase58(),
        }));
      return { main, other };
    } else {
      return;
    }
  }, [data, api]);

  return accounts === undefined ||
    // eslint-disable-next-line unicorn/no-null
    (accounts.main === undefined && accounts.other.length === 1) ? null : (
    <>
      <Section>
        <SubmenuTrigger>
          {children}
          <Menu items={accounts.other} className="-mr-20 xs:mr-0">
            {accounts.main === undefined ? (
              ({ account }) => <AccountMenuItem account={account} api={api} />
            ) : (
              <>
                <Section>
                  <Header className="mx-4 text-sm font-semibold">
                    Main Account
                  </Header>
                  <AccountMenuItem account={accounts.main} api={api} />
                </Section>
                {accounts.other.length > 0 && (
                  <>
                    <Separator />
                    <Section>
                      <Header className="mx-4 text-sm font-semibold">
                        Other Accounts
                      </Header>
                      <Collection items={accounts.other}>
                        {({ account }) => (
                          <AccountMenuItem account={account} api={api} />
                        )}
                      </Collection>
                    </Section>
                  </>
                )}
              </>
            )}
          </Menu>
        </SubmenuTrigger>
      </Section>
      <Separator />
    </>
  );
};

type AccountMenuItemProps = {
  api: States[ApiStateType.Loaded];
  account: PublicKey;
};

const AccountMenuItem = ({ account, api }: AccountMenuItemProps) => (
  <MenuItem
    onAction={() => {
      api.selectAccount(account);
    }}
    className={clsx({
      "pr-8 font-semibold": account === api.account,
    })}
    isDisabled={account === api.account}
  >
    <CheckIcon
      className={clsx("size-4 text-pythpurple-600", {
        invisible: account !== api.account,
      })}
    />
    <TruncatedKey>{account}</TruncatedKey>
  </MenuItem>
);

const ButtonContent = () => {
  const wallet = useWallet();
  const primaryDomain = usePrimaryDomain();

  if (primaryDomain) {
    return primaryDomain;
  } else if (wallet.publicKey) {
    return <TruncatedKey className="text-sm">{wallet.publicKey}</TruncatedKey>;
  } else if (wallet.connecting) {
    return "Connecting...";
  } else {
    return "Connect";
  }
};

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
    className={clsx("w-36 text-sm lg:text-base xl:w-52", className)}
    size="nopad"
    {...props}
  >
    <WalletIcon className="size-4 flex-none opacity-60" />
    {children}
  </Button>
);
