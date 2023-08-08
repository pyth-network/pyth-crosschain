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
 * Given a objectId, returns the latest package id that the object belongs to.
 * This is important, since packages can be upgraded, and a hard-coded package
 * id is likely to become obsolete or bricked at some point.
 * @param objectId
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

export async function getPythPackageId(
  stateId: string,
  provider: JsonRpcProvider
): Promise<ObjectId> {
  return await getPackageId(stateId, provider);
}

export async function getWormholePackageId(
  stateId: string,
  provider: JsonRpcProvider
): Promise<ObjectId> {
  return await getPackageId(stateId, provider);
}

export function getProvider(url: string) {
  return new JsonRpcProvider(new Connection({ fullnode: url }));
}

export async function updatePriceFeedWithAccumulator(
  signer: RawSigner,
  accumulator_msg: string,
  price_info_object_id: string,
  worm_package_id: string,
  worm_state_id: string,
  pyth_package_id: string,
  pyth_state_id: string
): Promise<any> {
  const tx = new TransactionBlock();

  // 0. verify VAA (that encodes the merkle root) in accumulator message
  let [verified_vaa] = tx.moveCall({
    target: `${worm_package_id}::vaa::parse_and_verify`,
    arguments: [
      tx.object(worm_state_id),
      tx.pure(parse_vaa_bytes_from_accumulator_message(accumulator_msg, true)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 1. obtain fee coin by splitting it off from the gas coin
  let [fee_coin] = tx.moveCall({
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

export function updatePriceFeedWithBatchPriceAttestation(url: string) {
  // TODO
}

// parse_vaa_bytes_from_accumulator_message obtains the vaa bytes embedded in an accumulator message,
// which can either be hex or base64.
// If isHex==false, then the accumulator_message is assumed to be in base64.
export function parse_vaa_bytes_from_accumulator_message(
  accumulator_message: string,
  isHex: boolean
): number[] {
  let b = isHex
    ? [...Buffer.from(accumulator_message, "hex")]
    : [...Buffer.from(accumulator_message, "base64")];
  // the bytes at offsets 0-5 in the accumulator msg encode the header, major, minor bytes
  // we ignore them, since we are only interested in the VAA bytes
  let trailing_size = b.slice(6, 7)[0];
  let vaa_size_offset =
    7 /* initial bytes (header, major, minor, trailing stuff size) */ +
    trailing_size /* trailing stuff (variable number of bytes) */ +
    1; /* proof_type (1 byte) */
  let vaa_size_bytes = b.slice(vaa_size_offset, vaa_size_offset + 2);
  let vaa_size = vaa_size_bytes[1] + 16 * vaa_size_bytes[0];
  let vaa_offset = vaa_size_offset + 2;
  let vaa = b.slice(vaa_offset, vaa_offset + vaa_size);
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
* const provider = new JsonRpcProvider(
       new Connection({ fullnode: "https://fullnode.mainnet.sui.io:443" })
   );
* const table_id =
   "0xc4a7182984a662b159a18a8754dbc15e11048b42494b2c4ddcf1ec3bcc7004fe";
* let table = await get_price_feed_ids_to_price_info_object_ids_table(table_id, provider)
*
*/
export async function get_price_feed_ids_to_price_info_object_ids_table(
  table_id: string,
  provider: JsonRpcProvider
) {
  let nextCursor;
  let hasNextPage = false;
  let map = new Map<string, string>();
  do {
    const dynamic_fields = await provider.getDynamicFields({
      parentId: table_id,
      cursor: nextCursor,
    });
    console.log(dynamic_fields);

    let promises = await Promise.all(
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
