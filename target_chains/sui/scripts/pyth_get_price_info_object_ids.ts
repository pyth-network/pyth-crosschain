/// We build a programmable txn to create a price feed.
import dotenv from "dotenv"
import axios from 'axios';

import { Connection, JsonRpcProvider, JsonRpcClient} from '@mysten/sui.js';
import { setMaxIdleHTTPParsers } from "http";

const provider = new JsonRpcProvider(
  new Connection({ fullnode: 'https://fullnode.mainnet.sui.io:443' }),
);

async function main() {
  const objectId = '0xc4a7182984a662b159a18a8754dbc15e11048b42494b2c4ddcf1ec3bcc7004fe';
  let nextCursor;
  let hasNextPage = false;
  let map = new Map<string, string>();
  do {
    const dynamic_fields = await provider.getDynamicFields({ parentId: objectId, cursor: nextCursor});
    console.log(dynamic_fields)

    let promises = await Promise.all(dynamic_fields.data.map(x => provider.getObject({id: x.objectId, options: {showContent: true}})))

    //@ts-ignore
    let key_value_pairs = promises.map(x=>[Buffer.from(x.data.content.fields.name.fields.bytes).toString("hex"), x.data.content.fields.value])
    console.log("key value pairs: ", key_value_pairs)
    for (let x of key_value_pairs){
      console.log("entry in key value pairs: ", x)
      map.set(x[0], x[1])
    }

    // pagination
    nextCursor = dynamic_fields.nextCursor
    hasNextPage = dynamic_fields.hasNextPage

    // Sleep to not hit rate limit.
    console.log("Going to sleep for 10 seconds...")
    await new Promise(f => setTimeout(f, 10000));

  } while(hasNextPage)

  console.log("map size: ", map.size)
  console.log("map is: ", map)
}

main();
