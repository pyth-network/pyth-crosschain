/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadHotWallet, WormholeEmitter } from "../src/node/utils/governance";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --cluster <cluster> --wallet-path <path_to_wallet_file> --message <message>",
  )
  .options({
    cluster: {
      choices: ["mainnet-beta", "testnet"],
      demandOption: true,
      describe: "The Pyth cluster to use for sending the message",
      type: "string",
    },
    message: {
      demandOption: true,
      describe: "The message in hex with no leading 0x to send to the wormhole",
      type: "string",
    },
    walletPath: {
      demandOption: true,
      describe:
        "Path to the wallet file to use for sending the message (e.g. ./walletPath.json)",
      type: "string",
    },
  });

async function main() {
  const { cluster, walletPath, message } = await parser.argv;

  const wallet = await loadHotWallet(walletPath);
  const emitter = new WormholeEmitter(cluster, wallet);
  const payload = Buffer.from(message, "utf8");
  const submittedMessage = await emitter.sendMessage(payload);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const _vaa = await submittedMessage.fetchVaa();
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
