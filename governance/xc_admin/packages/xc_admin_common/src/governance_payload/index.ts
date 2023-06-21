import { ExecutePostedVaa } from "./ExecutePostedVaa";
import { CosmosUpgradeContract } from "./UpgradeContract";
import {
  PythGovernanceAction,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
} from "./GovernanceDataSourceTransfer";
import { SetDataSources } from "./SetDataSources";
import { SetValidPeriod } from "./SetValidPeriod";
import { SetFee } from "./SetFee";

/** Decode a governance payload */
export function decodeGovernancePayload(
  data: Buffer
): PythGovernanceAction | undefined {
  const header = PythGovernanceHeader.decode(data);
  if (!header) return undefined;

  console.log(`Switching on action: ${header.action}`);
  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    case "UpgradeContract":
      //TO DO : Support non-cosmos upgrades
      return CosmosUpgradeContract.decode(data);
    case "AuthorizeGovernanceDataSourceTransfer":
      return AuthorizeGovernanceDataSourceTransfer.decode(data);
    case "SetDataSources":
      return SetDataSources.decode(data);
    case "SetFee":
      return SetFee.decode(data);
    case "SetValidPeriod":
      return SetValidPeriod.decode(data);
    case "RequestGovernanceDataSourceTransfer":
      return RequestGovernanceDataSourceTransfer.decode(data);
    default:
      return undefined;
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";
export * from "./PythGovernanceAction";
