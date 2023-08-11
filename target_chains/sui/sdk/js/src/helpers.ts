import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  ObjectId,
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  TransactionArgument,
} from "@mysten/sui.js";

/**
 * getPackageId returns the latest package id that the object belongs to.
 * @param objectId
 * @param provider
 */
export async function getPackageId(
  objectId: ObjectId,
  provider: JsonRpcProvider
): Promise<ObjectId> {
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

/**
 * getPythPackageId obtains the latest Pyth package ID given a Pyth state object ID.
 * (The state object ID is invariant across Sui contract upgrades, while the package ID necessarily
 * changes after each upgrade)
 * @param stateId - Sui Pyth state object ID
 * @param provider
 * @returns
 */
export async function getPythPackageId(
  stateId: string,
  provider: JsonRpcProvider
): Promise<ObjectId> {
  return await getPackageId(stateId, provider);
}

/**
 * getWormholePackageId obtains the latest Wormhole package ID given a Wormhole state object ID.
 * (The state object ID is invariant across Sui contract upgrades, while the package ID necessarily
 * changes after each upgrade)
 * @param stateId - Sui Wormhole state object ID
 * @param provider
 * @returns
 */
export async function getWormholePackageId(
  stateId: string,
  provider: JsonRpcProvider
): Promise<ObjectId> {
  return await getPackageId(stateId, provider);
}

export function getProvider(url: string) {
  return new JsonRpcProvider(new Connection({ fullnode: url }));
}

/**
 *
 * @param signer - signer representing a pivate/public keypair
 * @param price_update_msg - price udpate message in base64 format (either accumulator or batch price attestation)
 * @param price_info_object_id - Sui object ID of price info object corresponding to a price feed
 * @param worm_package_id - Sui package ID of Wormhole core bridge
 * @param worm_state_id - Sui object ID of Wormhole state object
 * @param pyth_package_id - Sui package ID of Pyth package
 * @param pyth_state_id - Sui object ID of Pyth state object
 * @returns result of executed sui transaction
 */
export async function updatePriceFeed(
  signer: RawSigner,
  price_update_msg: string,
  price_info_object_id: string,
  worm_package_id: string,
  worm_state_id: string,
  pyth_package_id: string,
  pyth_state_id: string
): Promise<any> {
  if (isAccumulatorMsg(price_update_msg)) {
    return updatePriceFeedWithAccumulator(
      signer,
      price_update_msg,
      price_info_object_id,
      worm_package_id,
      worm_state_id,
      pyth_package_id,
      pyth_state_id
    );
  } else {
    return updatePriceFeedWithBatchPriceAttestation(
      signer,
      price_update_msg,
      price_info_object_id,
      worm_package_id,
      worm_state_id,
      pyth_package_id,
      pyth_state_id
    );
  }
}

/**
 * @param signer - signer representing a pivate/public keypair
 * @param accumulator_msg - accumulator message in base64
 * @param price_info_object_id - Sui object ID of price info object corresponding to a price feed
 * @param worm_package_id - Sui package ID of Wormhole core bridge
 * @param worm_state_id - Sui object ID of Wormhole state object
 * @param pyth_package_id - Sui package ID of Pyth package
 * @param pyth_state_id - Sui object ID of Pyth state object
 * @returns result of executed sui transaction
 */
async function updatePriceFeedWithAccumulator(
  signer: RawSigner,
  accumulator_msg: string,
  price_info_object_id: string,
  worm_package_id: string,
  worm_state_id: string,
  pyth_package_id: string,
  pyth_state_id: string
): Promise<any> {
  console.log("======== updatePriceFeedWithAccumulator =========");
  console.log("signer: ", await signer.getAddress());
  console.log("accumulator_msg: ", accumulator_msg);
  console.log("price_info_object_id: ", price_info_object_id);
  console.log("worm_package_id: ", worm_package_id);
  console.log("worm_state_id: ", worm_state_id);
  console.log("pyth_package_id: ", pyth_package_id);
  console.log("pyth_state_id: ", pyth_state_id);
  console.log("================================================");

  // convert base64 str to hex
  accumulator_msg = Buffer.from(accumulator_msg, "base64").toString("hex");

  const tx = new TransactionBlock();

  // 0. verify VAA (that encodes the merkle root) in accumulator message
  const [verified_vaa] = tx.moveCall({
    target: `${worm_package_id}::vaa::parse_and_verify`,
    arguments: [
      tx.object(worm_state_id),
      tx.pure(parse_vaa_bytes_from_accumulator_message(accumulator_msg, true)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 1. obtain fee coin by splitting it off from the gas coin
  const [fee_coin] = tx.moveCall({
    target: "0x2::coin::split",
    arguments: [tx.gas, tx.pure(1)],
    typeArguments: ["0x2::sui::SUI"],
  });

  // 2. get authenticated price info vector, containing price updates
  let [authenticated_price_infos_vector] = tx.moveCall({
    target: `${pyth_package_id}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [
      tx.object(pyth_state_id),
      tx.pure([...Buffer.from(accumulator_msg, "hex")]),
      verified_vaa,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 3. use authenticated prices to update target price info object
  authenticated_price_infos_vector = tx.moveCall({
    target: `${pyth_package_id}::pyth::update_single_price_feed`,
    arguments: [
      tx.object(pyth_state_id),
      authenticated_price_infos_vector,
      tx.object(price_info_object_id),
      fee_coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 4. clean-up (destroy authenticated vector)
  tx.moveCall({
    target: `${pyth_package_id}::hot_potato_vector::destroy`,
    arguments: [authenticated_price_infos_vector],
    typeArguments: [`${pyth_package_id}::price_info::PriceInfo`],
  });

  tx.setGasBudget(2000000000);

  return await signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
}

/**
 *
 * @param signer - signer representing a pivate/public keypair
 * @param vaa - Wormhole VAA bytes in hex format
 * @param price_info_object_id - Sui object ID of price info object corresponding to a price feed
 * @param worm_package_id - Sui package ID of Wormhole core bridge
 * @param worm_state_id - Sui object ID of Wormhole state object
 * @param pyth_package_id - Sui package ID of Pyth package
 * @param pyth_state_id - Sui object ID of Pyth state object
 * @returns result of executing the sui transaction
 */
async function updatePriceFeedWithBatchPriceAttestation(
  signer: RawSigner,
  vaa: string, // batch price attestation VAA in base64
  price_info_object_id: string,
  worm_package_id: string,
  worm_state_id: string,
  pyth_package_id: string,
  pyth_state_id: string
): Promise<any> {
  console.log("====== updatePriceFeedWithBatchPriceAttestation ======");
  console.log("signer: ", await signer.getAddress());
  console.log("accumulator_msg: ", vaa);
  console.log("price_info_object_id: ", price_info_object_id);
  console.log("worm_package_id: ", worm_package_id);
  console.log("worm_state_id: ", worm_state_id);
  console.log("pyth_package_id: ", pyth_package_id);
  console.log("pyth_state_id: ", pyth_state_id);
  console.log("=====================================================");

  const tx = new TransactionBlock();

  // Parse our batch price attestation VAA bytes using Wormhole.
  // Check out the Wormhole cross-chain bridge and generic messaging protocol here:
  //     https://github.com/wormhole-foundation/wormhole
  let verified_vaas: TransactionArgument[] = [];
  const [verified_vaa] = tx.moveCall({
    target: `${worm_package_id}::vaa::parse_and_verify`,
    arguments: [
      tx.object(worm_state_id),
      tx.pure([...Buffer.from(vaa, "base64")]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  verified_vaas = verified_vaas.concat(verified_vaa);

  // Create a hot potato vector of price feed updates that will
  // be used to update price feeds.
  let [price_updates_hot_potato] = tx.moveCall({
    target: `${pyth_package_id}::pyth::create_price_infos_hot_potato`,
    arguments: [
      tx.object(pyth_state_id),
      tx.makeMoveVec({
        type: `${worm_package_id}::vaa::VAA`,
        objects: verified_vaas,
      }),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // Update each price info object (containing our price feeds of interest)
  // using the hot potato vector.
  const coin = tx.splitCoins(tx.gas, [tx.pure(1)]);
  [price_updates_hot_potato] = tx.moveCall({
    target: `${pyth_package_id}::pyth::update_single_price_feed`,
    arguments: [
      tx.object(pyth_state_id),
      price_updates_hot_potato,
      tx.object(price_info_object_id),
      coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // Explicitly destroy the hot potato vector, since it can't be dropped
  // automatically.
  tx.moveCall({
    target: `${pyth_package_id}::hot_potato_vector::destroy`,
    arguments: [price_updates_hot_potato],
    typeArguments: [`${pyth_package_id}::price_info::PriceInfo`],
  });

  tx.setGasBudget(2000000000);

  const result = await signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
  console.log(result);
  return result;
}

/**
 * parse_vaa_bytes_from_accumulator_message obtains the vaa bytes embedded in an accumulator message,
 * which can either be hex or base64.
 * If isHex==false, then the accumulator_message is assumed to be in base64.
 * @param accumulator_message - the accumulator price update message
 * @param isHex - whether the accumulator message is in hex format or not
 * @returns vaa bytes as a uint8 array
 */
function parse_vaa_bytes_from_accumulator_message(
  accumulator_message: string,
  isHex: boolean
): number[] {
  const b = isHex
    ? [...Buffer.from(accumulator_message, "hex")]
    : [...Buffer.from(accumulator_message, "base64")];
  // the bytes at offsets 0-5 in the accumulator msg encode the header, major, minor bytes
  // we ignore them, since we are only interested in the VAA bytes
  const trailing_size = b.slice(6, 7)[0];
  const vaa_size_offset =
    7 /* initial bytes (header, major, minor, trailing stuff size) */ +
    trailing_size /* trailing stuff (variable number of bytes) */ +
    1; /* proof_type (1 byte) */
  const vaa_size_bytes = b.slice(vaa_size_offset, vaa_size_offset + 2);
  const vaa_size = vaa_size_bytes[1] + 16 * vaa_size_bytes[0];
  const vaa_offset = vaa_size_offset + 2;
  const vaa = b.slice(vaa_offset, vaa_offset + vaa_size);
  return vaa;
}

/**
* get_price_feed_ids_to_price_info_object_ids_table fetches the entries of the
* table which stores the mapping of Pyth price feed ids to price info object ids.
* The table lives on-chain and its ID can be found by inspecting the Pyth State object.
* Note: this function may take 1 minute or more to run because we make it sleep
* intermittently to circumvent rate-limiting.
*
* Example usage:
*
*     const provider = new JsonRpcProvider(
           new Connection({ fullnode: "https://fullnode.mainnet.sui.io:443" })
       );
*     const table_id = "0xc4a7182984a662b159a18a8754dbc15e11048b42494b2c4ddcf1ec3bcc7004fe";
*     let table = await get_price_feed_ids_to_price_info_object_ids_table(table_id, provider;
*/
export async function get_price_feed_ids_to_price_info_object_ids_table(
  table_id: string,
  provider: JsonRpcProvider
) {
  let nextCursor;
  let hasNextPage = false;
  let map = new Map<string, string>();
  do {
    //@ts-ignore
    const dynamic_fields = await provider.getDynamicFields({
      parentId: table_id,
      cursor: nextCursor,
    });
    console.log(dynamic_fields);

    let promises = await Promise.all(
      //@ts-ignore
      dynamic_fields.data.map((x) =>
        provider.getObject({ id: x.objectId, options: { showContent: true } })
      )
    );

    let key_value_pairs = promises.map((x) => [
      //@ts-ignore
      Buffer.from(x.data.content.fields.name.fields.bytes).toString("hex"), //@ts-ignore
      x.data.content.fields.value,
    ]);
    console.log("key value pairs: ", key_value_pairs);
    for (let x of key_value_pairs) {
      console.log("entry in key value pairs: ", x);
      map.set(x[0], x[1]);
    }

    // pagination
    nextCursor = dynamic_fields.nextCursor;
    hasNextPage = dynamic_fields.hasNextPage;

    // Sleep to not hit rate limit.
    console.log("Going to sleep for 10 seconds...");
    await new Promise((f) => setTimeout(f, 10000));
  } while (hasNextPage);

  console.log("map size: ", map.size);
  console.log("map is: ", map);
  return map;
}

/**
 * @param msg - accumulator message in base64
 */
function isAccumulatorMsg(msg: string) {
  const ACCUMULATOR_MAGIC = "504e4155";
  return (
    Buffer.from(msg, "base64").toString("hex").slice(0, 8) === ACCUMULATOR_MAGIC
  );
}
