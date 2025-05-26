import { PublicKey } from "@solana/web3.js";
import { getProtoTypes } from "./proto_utils";

// Export all the creation functions and types
export * from "./AddPublisher";
export * from "./UpdatePublisher";
export * from "./AddFeed";
export * from "./UpdateFeed";
export * from "./proto_utils";

// Types for decoded actions
export type DecodedLazerGovernanceAction =
  | { type: "AddPublisher"; data: AddPublisherData }
  | { type: "UpdatePublisher"; data: UpdatePublisherData }
  | { type: "AddFeed"; data: AddFeedData }
  | { type: "UpdateFeed"; data: UpdateFeedData };

export interface AddPublisherData {
  publisherId: number;
  name: string;
  publicKeys: string[];
  isActive: boolean;
  shardFilter: any;
  governanceSource: PublicKey;
  sequenceNo: number;
}

export interface UpdatePublisherData {
  publisherId: number;
  action: any;
  shardFilter: any;
  governanceSource: PublicKey;
  sequenceNo: number;
}

export interface AddFeedData {
  priceFeedId: number;
  metadata: any;
  permissionedPublishers: number[];
  shardFilter: any;
  governanceSource: PublicKey;
  sequenceNo: number;
}

export interface UpdateFeedData {
  priceFeedId: number;
  action: any;
  shardFilter: any;
  governanceSource: PublicKey;
  sequenceNo: number;
}

/** Decode a Lazer governance payload */
export async function decodeLazerGovernancePayload(
  data: Buffer,
): Promise<DecodedLazerGovernanceAction | undefined> {
  try {
    const { GovernanceInstruction } = getProtoTypes();

    const message = GovernanceInstruction.decode(data);
    const decoded = GovernanceInstruction.toObject(message);

    if (!decoded.directives || decoded.directives.length === 0) {
      return undefined;
    }

    // Get the governance source
    const source = decoded.source?.singleEd25519?.publicKey;
    if (!source) return undefined;

    const governanceSource = new PublicKey(source);
    const sequenceNo = decoded.governanceSequenceNo || 0;

    // Process the first directive (assuming single directive per instruction for now)
    const directive = decoded.directives[0];
    const action = directive.action;

    if (action.addPublisher) {
      return {
        type: "AddPublisher",
        data: {
          publisherId: action.addPublisher.publisherId,
          name: action.addPublisher.name,
          publicKeys: action.addPublisher.publicKeys || [],
          isActive: action.addPublisher.isActive,
          shardFilter: directive.shardFilter,
          governanceSource,
          sequenceNo
        }
      };
    } else if (action.updatePublisher) {
      return {
        type: "UpdatePublisher",
        data: {
          publisherId: action.updatePublisher.publisherId,
          action: action.updatePublisher.action,
          shardFilter: directive.shardFilter,
          governanceSource,
          sequenceNo
        }
      };
    } else if (action.addFeed) {
      return {
        type: "AddFeed",
        data: {
          priceFeedId: action.addFeed.priceFeedId,
          metadata: action.addFeed.metadata,
          permissionedPublishers: action.addFeed.permissionedPublishers || [],
          shardFilter: directive.shardFilter,
          governanceSource,
          sequenceNo
        }
      };
    } else if (action.updateFeed) {
      return {
        type: "UpdateFeed",
        data: {
          priceFeedId: action.updateFeed.priceFeedId,
          action: action.updateFeed.action,
          shardFilter: directive.shardFilter,
          governanceSource,
          sequenceNo
        }
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
}
