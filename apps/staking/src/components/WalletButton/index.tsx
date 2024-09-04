"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSection,
  MenuSeparator,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import {
  WalletIcon,
  ArrowsRightLeftIcon,
  XCircleIcon,
  ChevronDownIcon,
  TableCellsIcon,
  BanknotesIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import {
  type ComponentProps,
  type ComponentType,
  type SVGAttributes,
  type ReactNode,
  type ElementType,
  type Ref,
  useCallback,
  useMemo,
  useState,
  forwardRef,
} from "react";

import { usePrimaryDomain } from "../../hooks/use-primary-domain";
import { StateType, useStakeAccount } from "../../hooks/use-stake-account";
import { AccountHistory } from "../AccountHistory";
import { Button } from "../Button";
import { RawModal } from "../Modal";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export const WalletButton = (props: Props) => {
  const wallet = useWallet();

  return wallet.connected ? (
    <ConnectedButton {...props} />
  ) : (
    <DisconnectedButton {...props} />
  );
};

const ConnectedButton = (props: Props) => {
  const [accountHistoryOpen, setAccountHistoryOpen] = useState(false);
  const openAccountHistory = useCallback(
    () =>
      setTimeout(() => {
        setAccountHistoryOpen(true);
      }, 300),
    [setAccountHistoryOpen],
  );
  const closeAccountHistory = useCallback(() => {
    setAccountHistoryOpen(false);
  }, [setAccountHistoryOpen]);

  const wallet = useWallet();
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);
  const stakeAccountState = useStakeAccount();

  return (
    <>
      <Menu as="div" className="relative">
        <MenuButton as="div" className="group">
          <ButtonComponent
            className="w-52 group-data-[open]:bg-pythpurple-600/60"
            {...props}
          >
            <span className="truncate">
              <ButtonContent />
            </span>
            <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[open]:-rotate-180" />
          </ButtonComponent>
        </MenuButton>
        <MenuItems
          transition
          anchor="bottom end"
          className="z-10 flex min-w-[var(--button-width)] origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus-visible:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <MenuSection className="flex w-full flex-col">
            {stakeAccountState.type === StateType.Loaded &&
              stakeAccountState.allAccounts.length > 1 && (
                <Listbox
                  value={stakeAccountState.account}
                  onChange={stakeAccountState.selectAccount}
                >
                  <WalletMenuItem as={ListboxButton} icon={BanknotesIcon}>
                    <span>Select stake account</span>
                    <ChevronRightIcon className="size-4" />
                  </WalletMenuItem>
                  <ListboxOptions
                    className="z-10 flex origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus-visible:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
                    anchor="left start"
                    transition
                  >
                    {stakeAccountState.allAccounts.map((account) => (
                      <WalletMenuItem
                        as={ListboxOption}
                        key={account.publicKey}
                        value={account}
                        className="cursor-pointer hover:bg-black/5"
                      >
                        <pre>{account.publicKey}</pre>
                      </WalletMenuItem>
                    ))}
                  </ListboxOptions>
                </Listbox>
              )}
            <MenuItem>
              <WalletMenuItem
                onClick={openAccountHistory}
                icon={TableCellsIcon}
              >
                Account history
              </WalletMenuItem>
            </MenuItem>
          </MenuSection>
          <MenuSeparator className="mx-2 my-1 h-px bg-black/20" />
          <MenuSection className="flex w-full flex-col">
            <MenuItem>
              <WalletMenuItem onClick={showModal} icon={ArrowsRightLeftIcon}>
                Change wallet
              </WalletMenuItem>
            </MenuItem>
            <MenuItem>
              <WalletMenuItem
                onClick={() => wallet.disconnect()}
                icon={XCircleIcon}
              >
                Disconnect
              </WalletMenuItem>
            </MenuItem>
          </MenuSection>
        </MenuItems>
      </Menu>
      <RawModal
        isOpen={accountHistoryOpen}
        onClose={closeAccountHistory}
        title="Account history"
        description="A history of events that have affected your account balances"
      >
        <AccountHistory />
      </RawModal>
    </>
  );
};

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

type WalletMenuItemProps<T extends ElementType> = Omit<
  ComponentProps<T>,
  "as" | "icon"
> & {
  as?: T;
  icon?: ComponentType<SVGAttributes<SVGSVGElement>>;
};

const WalletMenuItemImpl = <T extends ElementType>(
  { as, children, icon: Icon, className, ...props }: WalletMenuItemProps<T>,
  ref: Ref<HTMLButtonElement>,
) => {
  const Component = as ?? "button";
  return (
    <Component
      className={clsx(
        "flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left hover:bg-pythpurple-800/20 data-[focus]:bg-pythpurple-800/20",
        className,
      )}
      ref={ref}
      {...props}
    >
      {Icon && <Icon className="size-4 text-pythpurple-600" />}
      {children}
    </Component>
  );
};
const WalletMenuItem = forwardRef(WalletMenuItemImpl);

const DisconnectedButton = (props: Props) => {
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);

  return (
    <ButtonComponent onClick={showModal} className="w-52" {...props}>
      <span>Connect wallet</span>
    </ButtonComponent>
  );
};

type ButtonComponentProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "className"
> & {
  className?: string | undefined;
  children: ReactNode | ReactNode[];
};

const ButtonComponent = ({
  className,
  children,
  ...props
}: ButtonComponentProps) => (
  <Button
    className={clsx("flex flex-row items-center gap-2", className)}
    {...props}
  >
    <WalletIcon className="size-4 flex-none opacity-60" />
    {children}
  </Button>
);
