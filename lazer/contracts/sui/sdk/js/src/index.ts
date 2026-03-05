import type { GrpcCoreClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";

export async function addParseAndVerifyLeEcdsaUpdateCall(opts: {
  client: GrpcCoreClient;
  tx: Transaction;
  stateObjectId: string;
  update: Uint8Array;
}) {
  const { client, tx, stateObjectId, update } = opts;
  const id = await getLatestPackageId(client, stateObjectId);
  return tx.moveCall({
    arguments: [
      tx.object(stateObjectId),
      tx.object.clock(),
      tx.pure.vector("u8", update),
    ],
    target: `${id}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
  });
}

async function getLatestPackageId(
  client: GrpcCoreClient,
  stateObjectId: string,
): Promise<string> {
  const res = await client.getObject({
    include: { json: true },
    objectId: stateObjectId,
  });

  const state = res.object.json;
  if (
    hasProperty(state, "upgrade_cap") &&
    hasProperty(state.upgrade_cap, "package") &&
    typeof state.upgrade_cap.package === "string"
  ) {
    return state.upgrade_cap.package;
  } else {
    throw new Error(`Invalid Lazer state: ${JSON.stringify(state)}`);
  }
}

function hasProperty<const P extends string>(
  value: unknown,
  name: P,
): value is Record<P, unknown> {
  return typeof value === "object" && !!value && name in value;
}
