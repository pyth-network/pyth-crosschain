import { PublicKey } from "@solana/web3.js";
import { getProtoTypes } from "./proto_utils";

export interface AddFeedParams {
  priceFeedId: number;
  metadata: Record<string, unknown>; // DynamicValue.Map from proto
  permissionedPublishers?: number[];
  shardFilter?: {
    allShards?: Record<string, never>;
    shardNames?: { shardNames: string[] };
    shardGroups?: { shardGroups: string[] };
  };
  governanceSource: PublicKey;
  sequenceNo?: number;
}

/** Create an AddFeed governance instruction */
export async function createAddFeed(params: AddFeedParams): Promise<Buffer> {
  const { GovernanceInstruction, GovernanceDirective, AddFeed } = getProtoTypes();

  // Create AddFeed message using proto type
  const addFeedMessage = AddFeed.create({
    priceFeedId: params.priceFeedId,
    metadata: params.metadata,
    permissionedPublishers: params.permissionedPublishers || []
  });

  // Create GovernanceDirective using proto type
  const directive = GovernanceDirective.create({
    shardFilter: params.shardFilter || { allShards: {} },
    addFeed: addFeedMessage
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
