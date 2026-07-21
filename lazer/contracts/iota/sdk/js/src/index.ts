import type { IotaClient } from "@iota/iota-sdk/client";
import type { Transaction } from "@iota/iota-sdk/transactions";

export async function addParseAndVerifyLeEcdsaUpdateCall(opts: {
  client: IotaClient;
  tx: Transaction;
  stateObjectId: string;
  update: Uint8Array;
}) {
  const { client, tx, stateObjectId, update } = opts;
  const packageId = await getLatestPackageId(client, stateObjectId);
  return tx.moveCall({
    arguments: [
      tx.object(stateObjectId),
      tx.object.clock(),
      tx.pure.vector("u8", update),
    ],
    target: `${packageId}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
  });
}

async function getLatestPackageId(
  client: IotaClient,
  stateObjectId: string,
): Promise<string> {
  const { data: stateObject, error } = await client.getObject({
    id: stateObjectId,
    options: { showContent: true },
  });
  if (!stateObject?.content || error) {
    throw new Error(
      `Failed to get IOTA Lazer State: ${error?.code ?? "undefined"}`,
    );
  }
  if (stateObject.content.dataType !== "moveObject") {
    throw new Error(
      `IOTA Lazer State must be an object, got: ${stateObject.content.dataType}`,
    );
  }

  const { fields } = stateObject.content;
  if (!hasProperty(fields, "upgrade_cap")) {
    throw new Error("Missing 'upgrade_cap' in IOTA Lazer State");
  }
  const upgradeCap = fields.upgrade_cap;
  if (
    !hasProperty(upgradeCap, "fields") ||
    !hasProperty(upgradeCap.fields, "package") ||
    typeof upgradeCap.fields.package !== "string"
  ) {
    throw new Error("Could not find 'package' string in IOTA Lazer UpgradeCap");
  }
  return upgradeCap.fields.package;
}

function hasProperty<const P extends string>(
  value: unknown,
  name: P,
): value is Record<P, unknown> {
  return typeof value === "object" && value !== null && name in value;
}
