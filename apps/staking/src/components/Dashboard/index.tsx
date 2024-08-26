"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Field,
  Label,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import useSWR from "swr";

import { DashboardLoaded } from "./loaded";
import { WalletButton } from "./wallet-button";
import { type StakeAccount, loadData } from "../../api";
import { useApiContext } from "../../use-api-context";
import {
  StateType,
  StakeAccountProvider,
  useStakeAccount,
} from "../../use-stake-account";
import { AccountHistoryButton } from "../AccountHistoryButton";
import { LoadingSpinner } from "../LoadingSpinner";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const Dashboard = () => (
  <StakeAccountProvider>
    <DashboardHeader />
    <DashboardBody />
  </StakeAccountProvider>
);

const DashboardHeader = () => {
  const stakeAccountState = useStakeAccount();
  return (
    <header className="mb-4 flex flex-row items-center justify-end gap-4">
      {stakeAccountState.type === StateType.Loaded &&
        stakeAccountState.allAccounts.length > 1 && (
          <AccountSelector
            accounts={stakeAccountState.allAccounts}
            selectedAccount={stakeAccountState.account}
            setAccount={stakeAccountState.selectAccount}
          />
        )}
      {stakeAccountState.type === StateType.Loaded && <AccountHistoryButton />}
      <WalletButton />
    </header>
  );
};

type AccountSelectorProps = {
  selectedAccount: StakeAccount;
  accounts: [StakeAccount, ...StakeAccount[]];
  setAccount: (account: StakeAccount) => void;
};

const AccountSelector = ({
  accounts,
  selectedAccount,
  setAccount,
}: AccountSelectorProps) => (
  <Field className="flex flex-row items-center gap-2">
    <Label className="text-sm font-medium">Stake Account:</Label>
    <Listbox
      value={selectedAccount}
      onChange={setAccount}
      as="div"
      className="relative"
    >
      <ListboxButton className="flex flex-row items-center gap-4 rounded border border-black px-4 py-2">
        <pre>{selectedAccount.publicKey}</pre>
        <ChevronDownIcon className="size-4" />
      </ListboxButton>
      <ListboxOptions
        className="min-w-[var(--button-width)] rounded-xl border border-white/5 bg-white p-1 shadow transition duration-100 ease-in [--anchor-gap:var(--spacing-1)] focus:outline-none data-[leave]:data-[closed]:opacity-0"
        anchor="bottom start"
        transition
      >
        {accounts.map((account) => (
          <ListboxOption
            key={account.publicKey}
            value={account}
            className="cursor-pointer hover:bg-black/5"
          >
            <pre>{account.publicKey}</pre>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  </Field>
);

const DashboardBody = () => {
  const stakeAccountState = useStakeAccount();

  switch (stakeAccountState.type) {
    case StateType.Initialized:
    case StateType.Loading: {
      return <LoadingSpinner />;
    }
    case StateType.NoAccounts: {
      return <p>No stake account found for your wallet!</p>;
    }
    case StateType.Error: {
      return (
        <p>
          Uh oh, an error occurred while loading stake accounts. Please refresh
          and try again
        </p>
      );
    }
    case StateType.Loaded: {
      return <DashboardContents />;
    }
  }
};

const DashboardContents = () => {
  const data = useDashboardData();

  switch (data.type) {
    case DataStateType.NotLoaded:
    case DataStateType.Loading: {
      return <LoadingSpinner />;
    }
    case DataStateType.Error: {
      return <p>Uh oh, an error occured!</p>;
    }
    case DataStateType.Loaded: {
      return <DashboardLoaded {...data.data} />;
    }
  }
};

const useDashboardData = () => {
  const apiContext = useApiContext();

  const { data, isLoading, ...rest } = useSWR(
    apiContext.stakeAccount.publicKey,
    () => loadData(apiContext),
    {
      refreshInterval: REFRESH_INTERVAL,
    },
  );
  const error = rest.error as unknown;

  if (error) {
    return DataState.ErrorState(error);
  } else if (isLoading) {
    return DataState.Loading();
  } else if (data) {
    return DataState.Loaded(data);
  } else {
    return DataState.NotLoaded();
  }
};

enum DataStateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}
const DataState = {
  NotLoaded: () => ({ type: DataStateType.NotLoaded as const }),
  Loading: () => ({ type: DataStateType.Loading as const }),
  Loaded: (data: Awaited<ReturnType<typeof loadData>>) => ({
    type: DataStateType.Loaded as const,
    data,
  }),
  ErrorState: (error: unknown) => ({
    type: DataStateType.Error as const,
    error,
  }),
};
type DataState = ReturnType<(typeof DataState)[keyof typeof DataState]>;
