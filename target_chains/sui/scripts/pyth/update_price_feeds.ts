/// We build a programmable transaction to look up a PriceInfoObject ID
/// from a price feed ID, update the price feed, and finally fetch
/// the updated price.
///
/// https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
import dotenv from "dotenv";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@optke3/sui.js";

dotenv.config({ path: "~/.env" });

import { REGISTRY, NETWORK } from "../registry";

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET; // <= NOTE: Update this when changing network
const price_connection_url = "https://xc-mainnet.pyth.network"; // <= NOTE: Update this when changing network
const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

const connection = new PriceServiceConnection(
  price_connection_url,
  {
    priceFeedRequestConfig: {
      binary: true,
    },
  }
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("Wallet key unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(
        Buffer.from(walletPrivateKey, "hex")
    ),
    provider
  );
  console.log(wallet.getAddress());

  // update a single price feed
  const deployer = "0xf0bd738bf137f4cb0601713e95bb9307a5efe8d27f34c9e34f419e17b4e74099";// testnet
  const price_feed_id =
    "0x8b62866fcd3a25ff9118506444e9fe5171e67c61a049f4b4fdacdbc31ae862bb"; // testnet
  const vaa =
    "AQAAAAABAK46ShchGcySL+D7xbyKdz6C3FxGeMlAaAmDrb1l2LQTRsY7JOCMcKhvhYUvi6U+50JiFO8/AUudI+d5a4RZj/IBZFUq5QAAAAAAGqJ4OdZBsHdDwMtfaMUfjNMdLAdivsANxvzSVDPvGrW2AAAAAAFRKgMBUDJXSAADAAEAAQIABQCdbQGa55bF3PAaj/dFvylmM/7ksc5l+Znf6Dh2cLQS04AZeG8x6F01mM7Nq4ELJ4feD8IsLPmLTxb7Hlv1Z6CkMQAAAAACwJuKAAAAAAABP5D////4AAAAAAK5q0QAAAAAAADnMAEAAAABAAAAAgAAAABkVSrlAAAAAGRVKuUAAAAAZFUq4gAAAAACwJSlAAAAAAABOKsAAAAAZFUq36meZwvnpS94J0Hz0p7r3Wf8PzJV4TpTWn+5piu04/t3i2KGb806Jf+RGFBkROn+UXHmfGGgSfS0/azbwxroYrsAAAAACQzUggAAAAAAAU8K////+AAAAAAI90/oAAAAAAABzswBAAAAAQAAAAIAAAAAZFUq5QAAAABkVSrlAAAAAGRVKuEAAAAACQwGpAAAAAAAAgfMAAAAAGRVKt9+Yw45hhOUDjYjAl2plplx0/MalDbZej7hWqfLWEavS/cxEtStJv03zxjKmz9+bxpWK1lly8JuRIilQFUvGAcuAAAAAAAFHyQAAAAAAAAEgP////gAAAAAAAUXsgAAAAAAAALxAQAAAAEAAAACAAAAAGRVKuUAAAAAZFUq5QAAAABkVSrhAAAAAAAFHyIAAAAAAAAEfgAAAABkVSrfD+5d3AdqlvGg7TGQdX5DE6SESe17memDpYdZE5ORzgVs1cmcbYbfkosFYvJmF93vQAgY+JBzkfMIeWXmt4awswAAAAAALc8CAAAAAAAABm3////4AAAAAAAtgJUAAAAAAAAHJwEAAAABAAAAAgAAAABkVSrlAAAAAGRVKuUAAAAAZFUq4QAAAAAALc5GAAAAAAAAB4YAAAAAZFUq36lo4j3CfwMhZ7N8DkPz3CwQlXKtkOtI8gyvkMqhah5m6wDh+FhUnhIDT/iAt1kkVqcbQjeq9K6xbmPNm2i6TX4AAAAAAO7CdQAAAAAAAZX/////+AAAAAAA7e9ZAAAAAAAA95IBAAAAAQAAAAIAAAAAZFUq5QAAAABkVSrlAAAAAGRVKuQAAAAAAO7CdQAAAAAAAZX/AAAAAGRVKt8="
  const price_info_object_id =
    "0xc2c00924b47ce5a4c51b455dff49923c77b4d66eef4953b5b7abcabc1ed80a07";
  update_price_feeds(wallet, registry, vaa, price_info_object_id, deployer);
}

main();

async function update_price_feeds(
  signer: RawSigner,
  registry: any,
  vaa: string,
  object_id: string,
  deployer: string
) {
  const tx = new TransactionBlock();

  let PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"];
  let PYTH_STATE = registry["PYTH_STATE_ID"];
  let WORM_PACKAGE = registry["WORMHOLE_PACKAGE_ID"];
  let WORM_STATE = registry["WORMHOLE_STATE_ID"];
  console.log("PYTH_PACKAGE: ", PYTH_PACKAGE);
  console.log("PYTH_STATE: ", PYTH_STATE);
  console.log("WORM_PACKAGE: ", WORM_PACKAGE);
  console.log("WORM_STATE: ", WORM_STATE);
  console.log("SUI_CLOCK_OBJECT_ID: ", SUI_CLOCK_OBJECT_ID);

  let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure([...Buffer.from(vaa, "base64")]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const [coin] = tx.splitCoins(tx.gas, [tx.pure(1)]);
  tx.transferObjects([coin], tx.pure(deployer));

  let [price_updates_hot_potato_1] = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::create_price_infos_hot_potato`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.makeMoveVec({
        type: `${WORM_PACKAGE}::vaa::VAA`,
        objects: [verified_vaa],
      }),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // Signature:
  //      pyth_state: &PythState,
  //      price_updates: HotPotatoVector<PriceInfo>,
  //      price_info_object: &mut PriceInfoObject,
  //      fee: Coin<SUI>,
  //      clock: &Clock

  // This appears to fail with 'CommandArgumentError { arg_idx: 2, kind: TypeMismatch } in command 5'
  let [price_updates_hot_potato_2] = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::update_single_price_feed`,
    arguments: [
      tx.object(PYTH_STATE),
      price_updates_hot_potato_1,
      tx.object(object_id),
      coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ]
  });

  tx.moveCall({
    target: `${PYTH_PACKAGE}::hot_potato_vector::destroy`,
    arguments: [
      price_updates_hot_potato_2
    ],
    typeArguments: [
      `${PYTH_PACKAGE}::price_info::PriceInfo`
    ]
  });

  tx.setGasBudget(2000000000);

  let result = await signer.signAndExecuteTransactionBlock({
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
