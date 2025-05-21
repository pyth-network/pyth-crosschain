import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { WormholeEmitter, loadHotWallet } from "../src/node/utils/governance";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --cluster <cluster> --wallet-path <path_to_wallet_file> --message <message>",
  )
  .options({
    cluster: {
      type: "string",
      choices: ["mainnet-beta", "testnet"],
      demandOption: true,
      describe: "The Pyth cluster to use for sending the message",
    },
    walletPath: {
      type: "string",
      demandOption: true,
      describe:
        "Path to the wallet file to use for sending the message (e.g. ./walletPath.json)",
    },
    message: {
      type: "string",
      demandOption: true,
      describe: "The message in hex with no leading 0x to send to the wormhole",
    },
  });

async function main() {
  const { cluster, walletPath, message } = await parser.argv;

  const wallet = await loadHotWallet(walletPath);
  const emitter = new WormholeEmitter(cluster, wallet);

  console.log(`Sending message to wormhole using cluster ${cluster}...`);
  const payload = Buffer.from(message, "utf-8");
  const submittedMessage = await emitter.sendMessage(payload);
  console.log(
    `Message sent. Emitter: ${submittedMessage.emitter.toBase58()}, Sequence Number: ${
      submittedMessage.sequenceNumber
    }`,
  );
  console.log(`Sleeping for 5 seconds to allow the message to be processed...`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log(
    `Fetching VAA for message ${submittedMessage.emitter.toBase58()}, Sequence Number: ${
      submittedMessage.sequenceNumber
    }...`,
  );
  const vaa = await submittedMessage.fetchVaa();
  console.log(`VAA: ${vaa.toString("hex")}`);
}

main();
