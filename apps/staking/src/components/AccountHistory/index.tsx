import { ArrowPathIcon } from "@heroicons/react/24/outline";

import {
  type AccountHistoryAction,
  type StakeDetails,
  AccountHistoryItemType,
  StakeType,
} from "../../api";
import type { States, StateType as ApiStateType } from "../../hooks/use-api";
import { StateType, useData } from "../../hooks/use-data";
import { Tokens } from "../Tokens";

type Props = { api: States[ApiStateType.Loaded] };

export const AccountHistory = ({ api }: Props) => {
  const history = useData(api.accountHistoryCacheKey, api.loadAccountHistory);

  switch (history.type) {
    case StateType.NotLoaded:
    case StateType.Loading: {
      return <ArrowPathIcon className="size-6 animate-spin" />;
    }
    case StateType.Error: {
      return <p>Uh oh, an error occured!</p>;
    }
    case StateType.Loaded: {
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
                  <td className="pr-4">
                    <Description>{action}</Description>
                  </td>
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

const Description = ({ children }: { children: AccountHistoryAction }) => {
  switch (children.type) {
    case AccountHistoryItemType.Claim: {
      return "Rewards claimed";
    }
    case AccountHistoryItemType.AddTokens: {
      return "Tokens added";
    }
    case AccountHistoryItemType.LockedDeposit: {
      return `Locked tokens deposited, unlocking ${children.unlockDate.toLocaleString()}`;
    }
    case AccountHistoryItemType.RewardsCredited: {
      return "Rewards credited";
    }
    case AccountHistoryItemType.Slash: {
      return `Staked tokens slashed from ${children.publisherName}`;
    }
    case AccountHistoryItemType.StakeCreated: {
      return `Created stake position for ${getStakeDetails(children.details)}`;
    }
    case AccountHistoryItemType.StakeFinishedWarmup: {
      return `Warmup complete for position for ${getStakeDetails(children.details)}`;
    }
    case AccountHistoryItemType.Unlock: {
      return "Locked tokens unlocked";
    }
    case AccountHistoryItemType.UnstakeCreated: {
      return `Requested unstake for position for ${getStakeDetails(children.details)}`;
    }
    case AccountHistoryItemType.UnstakeExitedCooldown: {
      return `Cooldown completed for ${getStakeDetails(children.details)}`;
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
