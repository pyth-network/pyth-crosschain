import { ExecutePostedVaa } from "./ExecutePostedVaa";
import {
  AptosAuthorizeUpgradeContract,
  CosmosUpgradeContract,
  EvmUpgradeContract,
} from "./UpgradeContract";
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
import { EvmSetWormholeAddress } from "./SetWormholeAddress";
import { EvmExecute } from "./ExecuteAction";

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
      // NOTE: the only way to distinguish the different types of upgrade contract instructions
      // is their payload lengths. We're getting a little lucky here that all of these upgrade instructions
      // have different-length payloads.
      const payloadLength = data.length - PythGovernanceHeader.span;
      if (payloadLength == CosmosUpgradeContract.layout.span) {
        return CosmosUpgradeContract.decode(data);
      } else if (payloadLength == AptosAuthorizeUpgradeContract.layout.span) {
        return AptosAuthorizeUpgradeContract.decode(data);
      } else if (payloadLength == EvmUpgradeContract.layout.span) {
        return EvmUpgradeContract.decode(data);
      } else {
        return undefined;
      }
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
    case "SetWormholeAddress":
      return EvmSetWormholeAddress.decode(data);
    case "Execute":
      return EvmExecute.decode(data);
    default:
      return undefined;
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";
export * from "./PythGovernanceAction";
export * from "./UpgradeContract";
export * from "./PythGovernanceAction";
export * from "./GovernanceDataSourceTransfer";
export * from "./SetDataSources";
export * from "./SetValidPeriod";
export * from "./SetFee";
export * from "./SetWormholeAddress";
export * from "./ExecuteAction";
