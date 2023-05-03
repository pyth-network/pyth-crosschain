/// We build a programmable txn to create a price feed.
import dotenv from "dotenv"
import axios from 'axios';

import { Connection, JsonRpcProvider, JsonRpcClient} from '@mysten/sui.js';

const provider = new JsonRpcProvider(
  new Connection({ fullnode: 'https://fullnode.mainnet.sui.io:443' }),
);

async function main() {
  const objectId = '0xc4a7182984a662b159a18a8754dbc15e11048b42494b2c4ddcf1ec3bcc7004fe';
  let nextCursor;
  let hasNextPage = false;
  let all_key_value_pairs;
  do {
    const dynamic_fields = await provider.getDynamicFields({ parentId: objectId, cursor: nextCursor});
    //console.log(dynamic_fields)
    let promises = await Promise.all(dynamic_fields.data.map(x => provider.getObject({id: x.objectId, options: {showContent: true}})))
    all_key_value_pairs = all_key_value_pairs + promises;
    nextCursor = dynamic_fields.nextCursor
    hasNextPage = dynamic_fields.hasNextPage

    // Sleep to not hit rate limit
    console.log("Going to sleep for 10 seconds to stay under rate limit...")
    await new Promise(f => setTimeout(f, 1000));

  } while(hasNextPage)
  console.log(all_key_value_pairs.length)
}

main();
