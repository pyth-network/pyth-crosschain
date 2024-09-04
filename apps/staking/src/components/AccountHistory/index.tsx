import useSWR from "swr";

import {
  type AccountHistoryAction,
  type StakeDetails,
  AccountHistoryItemType,
  StakeType,
  loadAccountHistory,
} from "../../api";
import { useApiContext } from "../../hooks/use-api-context";
import { LoadingSpinner } from "../LoadingSpinner";
import { Tokens } from "../Tokens";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const AccountHistory = () => {
  const history = useAccountHistoryData();

  switch (history.type) {
    case DataStateType.NotLoaded:
    case DataStateType.Loading: {
      return <LoadingSpinner />;
    }
    case DataStateType.Error: {
      return <p>Uh oh, an error occured!</p>;
    }
    case DataStateType.Loaded: {
      return (
        <table className="text-sm">
          <thead className="font-medium">
            <tr>
              <td className="pr-4">Timestamp</td>
              <td className="pr-4">Description</td>
              <td className="pr-4">Amount</td>
              <td className="pr-4">Account Total</td>
              <td className="pr-4">Available Rewards</td>
              <td className="pr-4">Available to Withdraw</td>
              <td>Locked</td>
            </tr>
          </thead>
          <tbody>
            {history.data.map(
              (
                {
                  accountTotal,
                  action,
                  amount,
                  availableRewards,
                  availableToWithdraw,
                  locked,
                  timestamp,
                },
                i,
              ) => (
                <tr key={i}>
                  <td className="pr-4">{timestamp.toLocaleString()}</td>
                  <td className="pr-4">{mkDescription(action)}</td>
                  <td className="pr-4">
                    <Tokens>{amount}</Tokens>
                  </td>
                  <td className="pr-4">
                    <Tokens>{accountTotal}</Tokens>
                  </td>
                  <td className="pr-4">
                    <Tokens>{availableRewards}</Tokens>
                  </td>
                  <td className="pr-4">
                    <Tokens>{availableToWithdraw}</Tokens>
                  </td>
                  <td>
                    <Tokens>{locked}</Tokens>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      );
    }
  }
};

const mkDescription = (action: AccountHistoryAction): string => {
  switch (action.type) {
    case AccountHistoryItemType.Claim: {
      return "Rewards claimed";
    }
    case AccountHistoryItemType.Deposit: {
      return "Tokens deposited";
    }
    case AccountHistoryItemType.LockedDeposit: {
      return `Locked tokens deposited, unlocking ${action.unlockDate.toLocaleString()}`;
    }
    case AccountHistoryItemType.RewardsCredited: {
      return "Rewards credited";
    }
    case AccountHistoryItemType.Slash: {
      return `Staked tokens slashed from ${action.publisherName}`;
    }
    case AccountHistoryItemType.StakeCreated: {
      return `Created stake position for ${getStakeDetails(action.details)}`;
    }
    case AccountHistoryItemType.StakeFinishedWarmup: {
      return `Warmup complete for position for ${getStakeDetails(action.details)}`;
    }
    case AccountHistoryItemType.Unlock: {
      return "Locked tokens unlocked";
    }
    case AccountHistoryItemType.UnstakeCreated: {
      return `Requested unstake for position for ${getStakeDetails(action.details)}`;
    }
    case AccountHistoryItemType.UnstakeExitedCooldown: {
      return `Cooldown completed for ${getStakeDetails(action.details)}`;
    }
    case AccountHistoryItemType.Withdrawal: {
      return "Tokens withdrawn to wallet";
    }
  }
};

const getStakeDetails = (details: StakeDetails): string => {
  switch (details.type) {
    case StakeType.Governance: {
      return "Governance Staking";
    }
    case StakeType.IntegrityStaking: {
      return `Integrity Staking, publisher: ${details.publisherName}`;
    }
  }
};

const useAccountHistoryData = () => {
  const apiContext = useApiContext();

  const { data, isLoading, ...rest } = useSWR(
    `${apiContext.stakeAccount.address.toBase58()}/history`,
    () => loadAccountHistory(apiContext),
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
  Loaded: (data: Awaited<ReturnType<typeof loadAccountHistory>>) => ({
    type: DataStateType.Loaded as const,
    data,
  }),
  ErrorState: (error: unknown) => ({
    type: DataStateType.Error as const,
    error,
  }),
};
type DataState = ReturnType<(typeof DataState)[keyof typeof DataState]>;
