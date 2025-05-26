import { PublicKey } from "@solana/web3.js";
import { getProtoTypes } from "./proto_utils";

export type UpdatePublisherAction =
  | { type: "setPublisherName"; name: string }
  | { type: "addPublisherPublicKeys"; publicKeys: Uint8Array[] }
  | { type: "removePublisherPublicKeys"; publicKeys: Uint8Array[] }
  | { type: "setPublisherPublicKeys"; publicKeys: Uint8Array[] }
  | { type: "setPublisherActive"; isActive: boolean }
  | { type: "removePublisher" };

export interface UpdatePublisherParams {
  publisherId: number;
  action: UpdatePublisherAction;
  shardFilter?: {
    allShards?: Record<string, never>;
    shardNames?: { shardNames: string[] };
    shardGroups?: { shardGroups: string[] };
  };
  governanceSource: PublicKey;
  sequenceNo?: number;
}

/** Create an UpdatePublisher governance instruction */
export async function createUpdatePublisher(params: UpdatePublisherParams): Promise<Buffer> {
  const {
    GovernanceInstruction,
    GovernanceDirective,
    UpdatePublisher,
    SetPublisherName,
    SetPublisherActive,
    AddPublisherPublicKeys,
    RemovePublisherPublicKeys,
    SetPublisherPublicKeys
  } = getProtoTypes();

  // Create the appropriate action message based on type
  let actionMessage: any = {};

  switch (params.action.type) {
    case "setPublisherName":
      actionMessage.setPublisherName = SetPublisherName.create({
        name: params.action.name
      });
      break;
    case "addPublisherPublicKeys":
      actionMessage.addPublisherPublicKeys = AddPublisherPublicKeys.create({
        publicKeys: params.action.publicKeys
      });
      break;
    case "removePublisherPublicKeys":
      actionMessage.removePublisherPublicKeys = RemovePublisherPublicKeys.create({
        publicKeys: params.action.publicKeys
      });
      break;
    case "setPublisherPublicKeys":
      actionMessage.setPublisherPublicKeys = SetPublisherPublicKeys.create({
        publicKeys: params.action.publicKeys
      });
      break;
    case "setPublisherActive":
      actionMessage.setPublisherActive = SetPublisherActive.create({
        isActive: params.action.isActive
      });
      break;
    case "removePublisher":
      actionMessage.removePublisher = {};
      break;
  }

  // Create UpdatePublisher message using proto type
  const updatePublisherMessage = UpdatePublisher.create({
    publisherId: params.publisherId,
    ...actionMessage
  });

  // Create GovernanceDirective using proto type
  const directive = GovernanceDirective.create({
    shardFilter: params.shardFilter || { allShards: {} },
    updatePublisher: updatePublisherMessage
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
