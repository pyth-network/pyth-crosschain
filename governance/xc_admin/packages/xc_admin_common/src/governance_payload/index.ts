import { ExecutePostedVaa } from "./ExecutePostedVaa";
import { CosmosUpgradeContract } from "./UpgradeContract";
import {
  PythGovernanceAction,
  PythGovernanceHeader,
} from "./PythGovernanceAction";

/** Decode a governance payload */
export function decodeGovernancePayload(
  data: Buffer
): PythGovernanceAction | undefined {
  const header = PythGovernanceHeader.decode(data);
  if (!header) return undefined;

  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    case "UpgradeContract":
      //TO DO : Support non-cosmos upgrades
      return CosmosUpgradeContract.decode(data);
    default:
      return undefined;
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";
export * from "./PythGovernanceAction";
