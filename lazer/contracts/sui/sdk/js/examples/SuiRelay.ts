import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SuiLazerClient } from "../src/client.js";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

type Args = {
  nodeUrl: string;
  packageId: string;
  stateObjectId: string;
  lazerUrls: string[];
  token?: string;
  timeoutMs: number;
};

function parseArgs(argv: string[]): Args {
  const res: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--nodeUrl" && argv[i + 1]) res.nodeUrl = argv[++i];
    else if (arg === "--packageId" && argv[i + 1]) res.packageId = argv[++i];
    else if (arg === "--stateObjectId" && argv[i + 1]) res.stateObjectId = argv[++i];
    else if (arg === "--lazerUrl" && argv[i + 1]) res.lazerUrls = [argv[++i]];
    else if (arg === "--lazerUrls" && argv[i + 1]) res.lazerUrls = argv[++i].split(",");
    else if (arg === "--token" && argv[i + 1]) res.token = argv[++i];
    else if (arg === "--timeoutMs" && argv[i + 1]) res.timeoutMs = parseInt(argv[++i], 10);
  }
  if (!res.nodeUrl || !res.packageId || !res.stateObjectId || !res.lazerUrls?.length) {
    throw new Error(
      "Usage: tsx examples/SuiRelay.ts --nodeUrl <URL> --packageId <ID> --stateObjectId <ID> (--lazerUrl <WSS>|--lazerUrls <WSS1,WSS2,...>) [--token <TOKEN>] [--timeoutMs <ms>]"
    );
  }
  return {
    nodeUrl: res.nodeUrl!,
    packageId: res.packageId!,
    stateObjectId: res.stateObjectId!,
    lazerUrls: res.lazerUrls!,
    token: res.token,
    timeoutMs: res.timeoutMs ?? 5000,
  };
}

async function getOneLeEcdsaUpdate(urls: string[], token: string | undefined, timeoutMs: number) {
  const config: Parameters<typeof PythLazerClient.create>[0] = {
    urls,
    token: token ?? "",
    numConnections: 1,
  };
  const lazer = await PythLazerClient.create(config);
  return new Promise<Buffer>((resolve, reject) => {
    const timeout = setTimeout(() => {
      lazer.shutdown();
      reject(new Error("Timed out waiting for leEcdsa update"));
    }, timeoutMs);
    lazer.addMessageListener((event) => {
      if (event.type === "binary" && event.value.leEcdsa) {
        clearTimeout(timeout);
        const buf = event.value.leEcdsa;
        lazer.shutdown();
        resolve(buf);
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const provider = new SuiClient({ url: args.nodeUrl });
  const client = new SuiLazerClient(provider);

  const updateBytes = await getOneLeEcdsaUpdate(args.lazerUrls, args.token, args.timeoutMs);

  const tx = new Transaction();
  const updateVal = client.addParseAndVerifyLeEcdsaUpdateCall({
    tx,
    packageId: args.packageId,
    stateObjectId: args.stateObjectId,
    updateBytes,
  });

  console.log("Built transaction; update value present:", !!updateVal);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
