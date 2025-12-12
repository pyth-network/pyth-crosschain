import type { MoveValue, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

export async function addParseAndVerifyLeEcdsaUpdateCall(opts: {
  client: SuiClient;
  tx: Transaction;
  stateObjectId: string;
  update: Uint8Array;
}) {
  const { client, tx, stateObjectId, update } = opts;
  const latestPackageId = await getLatestPackageId(client, stateObjectId);
  return tx.moveCall({
    target: `${latestPackageId}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
    arguments: [
      tx.object(stateObjectId),
      tx.object.clock(),
      tx.pure.vector("u8", update),
    ],
  });
}

async function getLatestPackageId(
  client: SuiClient,
  stateObjectId: string,
): Promise<string> {
  const { data: stateObject, error } = await client.getObject({
    id: stateObjectId,
    options: { showContent: true },
  });
  if (!stateObject?.content || error) {
    throw new Error(
      `Failed to get Sui Lazer State: ${error?.code ?? "undefined"}`,
    );
  }
  if (stateObject.content.dataType !== "moveObject") {
    throw new Error(
      `Sui Lazer State must be an object, got: ${stateObject.content.dataType}`,
    );
  }

  const state = stateObject.content;
  if (!hasStructField(state, "upgrade_cap")) {
    throw new Error("Missing 'upgrade_cap' in Sui Lazer State");
  }
  const upgradeCap = state.fields.upgrade_cap;
  if (
    !hasStructField(upgradeCap, "package") ||
    typeof upgradeCap.fields.package !== "string"
  ) {
    throw new Error("Could not find 'package' string in Sui Lazer UpgradeCap");
  }
  return upgradeCap.fields.package;
}

function hasStructField<const F extends string>(
  value: MoveValue,
  name: F,
): value is { fields: Record<F, MoveValue> } {
  return hasProperty(value, "fields") && hasProperty(value.fields, name);
}

function hasProperty<const P extends string>(
  value: unknown,
  name: P,
): value is Record<P, unknown> {
  return typeof value === "object" && !!value && name in value;
}
