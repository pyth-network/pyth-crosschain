import { Connection, JsonRpcProvider } from "@mysten/sui.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  DefaultStore,
  SuiContract,
} from "@pythnetwork/pyth-contract-manager/lib";

const parser = yargs(hideBin(process.argv))
  .scriptName("get_price_info_object_ids.ts")
  .usage("Usage: $0 --contract <contract_id>")
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract id",
    },
  });
async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract] as SuiContract;
  const provider = new JsonRpcProvider(
    new Connection({ fullnode: contract.chain.rpcUrl })
  );
  const objectId = await contract.getPriceTableId();

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
