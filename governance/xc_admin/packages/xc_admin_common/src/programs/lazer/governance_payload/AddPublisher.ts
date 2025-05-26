import { PublicKey } from "@solana/web3.js";
import { getProtoTypes } from "./proto_utils";

export interface AddPublisherParams {
  publisherId: number;
  name: string;
  publicKeys: Uint8Array[];
  isActive: boolean;
  shardFilter?: {
    allShards?: Record<string, never>;
    shardNames?: { shardNames: string[] };
    shardGroups?: { shardGroups: string[] };
  };
  governanceSource: PublicKey;
  sequenceNo?: number;
}

/** Create an AddPublisher governance instruction */
export async function createAddPublisher(params: AddPublisherParams): Promise<Buffer> {
  const { GovernanceInstruction, GovernanceDirective, AddPublisher } = getProtoTypes();

  // Create AddPublisher message using proto type
  const addPublisherMessage = AddPublisher.create({
    publisherId: params.publisherId,
    name: params.name,
    publicKeys: params.publicKeys,
    isActive: params.isActive
  });

  // Create GovernanceDirective using proto type
  const directive = GovernanceDirective.create({
    shardFilter: params.shardFilter || { allShards: {} },
    addPublisher: addPublisherMessage
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
