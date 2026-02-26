import { EvmExecute } from "./ExecuteAction";
import { ExecutePostedVaa } from "./ExecutePostedVaa";
import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
} from "./GovernanceDataSourceTransfer";
import type { PythGovernanceAction } from "./PythGovernanceAction";
import { PythGovernanceHeader } from "./PythGovernanceAction";
import { SetDataSources } from "./SetDataSources";
import { SetFee, SetFeeInToken } from "./SetFee";
import { SetTransactionFee } from "./SetTransactionFee";
import { SetValidPeriod } from "./SetValidPeriod";
import {
  EvmSetWormholeAddress,
  StarknetSetWormholeAddress,
} from "./SetWormholeAddress";
import {
  UpdateTrustedSigner256Bit,
  UpdateTrustedSigner264Bit,
} from "./UpdateTrustedSigner";
import {
  CosmosUpgradeContract,
  EvmUpgradeContract,
  UpgradeContract256Bit,
} from "./UpgradeContract";
import {
  UpgradeCardanoLazerContract,
  UpgradeSuiLazerContract,
} from "./UpgradeLazerContract";
import { WithdrawFee } from "./WithdrawFee";

/** Decode a governance payload */
export function decodeGovernancePayload(
  data: Buffer,
): PythGovernanceAction | undefined {
  const header = PythGovernanceHeader.decode(data);
  if (!header) return undefined;

  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    case "UpgradeContract": {
      // NOTE: the only way to distinguish the different types of upgrade contract instructions
      // is their payload lengths. We're getting a little lucky here that all of these upgrade instructions
      // have different-length payloads.
      const payloadLength = data.length - PythGovernanceHeader.span;
      if (payloadLength == CosmosUpgradeContract.layout.span) {
        return CosmosUpgradeContract.decode(data);
      } else if (payloadLength == UpgradeContract256Bit.layout.span) {
        return UpgradeContract256Bit.decode(data);
      } else if (payloadLength == EvmUpgradeContract.layout.span) {
        return EvmUpgradeContract.decode(data);
      } else {
        return undefined;
      }
    }
    case "AuthorizeGovernanceDataSourceTransfer":
      return AuthorizeGovernanceDataSourceTransfer.decode(data);
    case "SetDataSources":
      return SetDataSources.decode(data);
    case "SetFee":
      return SetFee.decode(data);
    case "SetFeeInToken":
      return SetFeeInToken.decode(data);
    case "SetValidPeriod":
      return SetValidPeriod.decode(data);
    case "RequestGovernanceDataSourceTransfer":
      return RequestGovernanceDataSourceTransfer.decode(data);
    case "SetWormholeAddress": {
      // NOTE: the only way to distinguish the different types of upgrade contract instructions
      // is their payload lengths. We're getting a little lucky here that all of these upgrade instructions
      // have different-length payloads.
      const payloadLength = data.length - PythGovernanceHeader.span;
      if (payloadLength == EvmSetWormholeAddress.layout.span) {
        return EvmSetWormholeAddress.decode(data);
      } else if (payloadLength == StarknetSetWormholeAddress.layout.span) {
        return StarknetSetWormholeAddress.decode(data);
      } else {
        return undefined;
      }
    }
    case "Execute":
      return EvmExecute.decode(data);
    case "SetTransactionFee":
      return SetTransactionFee.decode(data);
    case "WithdrawFee":
      return WithdrawFee.decode(data);
    case "UpgradeSuiLazerContract":
      return UpgradeSuiLazerContract.decode(data);
    case "UpgradeCardanoLazerContract":
      return UpgradeCardanoLazerContract.decode(data);
    case "UpdateTrustedSigner": {
      const payloadLength = data.length - PythGovernanceHeader.span;
      if (payloadLength == UpdateTrustedSigner264Bit.layout.span) {
        return UpdateTrustedSigner264Bit.decode(data);
      } else if (payloadLength == UpdateTrustedSigner256Bit.layout.span) {
        return UpdateTrustedSigner256Bit.decode(data);
      } else {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

export * from "./ExecuteAction";
export { ExecutePostedVaa } from "./ExecutePostedVaa";
export * from "./GovernanceDataSourceTransfer";
export * from "./PythGovernanceAction";
export * from "./PythGovernanceAction";
export * from "./SetDataSources";
export * from "./SetFee";
export * from "./SetTransactionFee";
export * from "./SetValidPeriod";
export * from "./SetWormholeAddress";
export * from "./UpdateTrustedSigner";
export * from "./UpgradeContract";
export * from "./UpgradeLazerContract";
export * from "./WithdrawFee";
