import { PublicKey } from "@solana/web3.js";
import { getProtoTypes } from "./proto_utils";

export type UpdateFeedAction =
  | { type: "updateFeedMetadata"; name: string; value?: any }
  | { type: "activateFeed"; activationTimestamp?: string }
  | { type: "deactivateFeed"; deactivationTimestamp?: string }
  | { type: "removeFeed" };

export interface UpdateFeedParams {
  priceFeedId: number;
  action: UpdateFeedAction;
  shardFilter?: {
    allShards?: Record<string, never>;
    shardNames?: { shardNames: string[] };
    shardGroups?: { shardGroups: string[] };
  };
  governanceSource: PublicKey;
  sequenceNo?: number;
}

/** Create an UpdateFeed governance instruction */
export async function createUpdateFeed(params: UpdateFeedParams): Promise<Buffer> {
  const { GovernanceInstruction, GovernanceDirective, UpdateFeed, UpdateFeedMetadata, ActivateFeed, DeactivateFeed } = getProtoTypes();

  // Create the appropriate action message based on type
  let actionMessage: any = {};

  switch (params.action.type) {
    case "updateFeedMetadata":
      actionMessage.updateFeedMetadata = UpdateFeedMetadata.create({
        name: params.action.name,
        value: params.action.value
      });
      break;
    case "activateFeed":
      actionMessage.activateFeed = ActivateFeed.create({});
      break;
    case "deactivateFeed":
      actionMessage.deactivateFeed = DeactivateFeed.create({});
      break;
    case "removeFeed":
      actionMessage.removeFeed = {};
      break;
  }

  // Create UpdateFeed message using proto type
  const updateFeedMessage = UpdateFeed.create({
    priceFeedId: params.priceFeedId,
    ...actionMessage
  });

  // Create GovernanceDirective using proto type
  const directive = GovernanceDirective.create({
    shardFilter: params.shardFilter || { allShards: {} },
    updateFeed: updateFeedMessage
  });

  const governanceInstruction = {
    source: {
      singleEd25519: {
        publicKey: params.governanceSource.toBytes()
      }
    },
    directives: [directive],
    governanceSequenceNo: params.sequenceNo || Date.now()
  };

  const message = GovernanceInstruction.create(governanceInstruction);
  return Buffer.from(GovernanceInstruction.encode(message).finish());
}
