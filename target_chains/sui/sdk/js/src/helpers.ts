import {
    Connection,
    Ed25519Keypair,
    JsonRpcProvider,
    ObjectId,
    RawSigner,
    SUI_CLOCK_OBJECT_ID,
    TransactionBlock,
  } from "@mysten/sui.js";

/**
* Given a objectId, returns the id for the package that the object belongs to.
* @param objectId
*/
export async function getPackageId(objectId: ObjectId, provider: JsonRpcProvider): Promise<ObjectId> {
    const state = await provider
      .getObject({
        id: objectId,
        options: {
          showContent: true,
        },
      })
      .then((result) => {
        if (result.data?.content?.dataType == "moveObject") {
          return result.data.content.fields;
        }

        throw new Error("not move object");
      });

    if ("upgrade_cap" in state) {
      return state.upgrade_cap.fields.package;
    }

    throw new Error("upgrade_cap not found");
  }

  export async function getPythPackageId(stateId: string, provider: JsonRpcProvider): Promise<ObjectId> {
    return await getPackageId(stateId, provider);
  }

  export async function getWormholePackageId(stateId: string, provider: JsonRpcProvider): Promise<ObjectId> {
    return await getPackageId(stateId, provider);
  }

  export function getProvider(url: string) {
    return new JsonRpcProvider(new Connection({ fullnode: url }));
  }

  export function updatePriceFeedWithAccumulator(
    signer: RawSigner,
    vaa: string,
    object_id: string,
  ) {
    return new JsonRpcProvider(new Connection({ fullnode: url }));
  }

  export function updatePriceFeedWithBatchPriceAttestation(url: string) {
    return new JsonRpcProvider(new Connection({ fullnode: url }));
  }