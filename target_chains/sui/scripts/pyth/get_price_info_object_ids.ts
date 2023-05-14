import { Connection, JsonRpcProvider } from "@mysten/sui.js";

const provider = new JsonRpcProvider(
  new Connection({ fullnode: "https://fullnode.testnet.sui.io:443" }) // <= NOTE: Update this when changing network
);
const objectId =
  "0xf8929174008c662266a1adde78e1e8e33016eb7ad37d379481e860b911e40ed5"; // <= NOTE: Update this when changing network AND with new deployment

async function main() {
  // Table of Sui Pyth PriceIdentifier => Price Info Object IDs

  let nextCursor;
  let hasNextPage = false;
  let map = new Map<string, string>();
  do {
    const dynamic_fields = await provider.getDynamicFields({
      parentId: objectId,
      cursor: nextCursor,
    });
    console.log(dynamic_fields);

    let promises = await Promise.all(
      dynamic_fields.data.map((x) =>
        provider.getObject({ id: x.objectId, options: { showContent: true } })
      )
    );

    //@ts-ignore
    let get_key = (x) =>
      Buffer.from(x.data.content.fields.name.fields.bytes).toString("hex");
    let get_value = (x) => x.data.content.fields.value;
    let key_value_pairs = promises.map((x) => [get_key(x), get_value(x)]);
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
}

main();
