/** biome-ignore-all lint/suspicious/noConsole: used in CLI */
import { Cluster, Config, Container, Genesis } from "@evolution-sdk/devnet";
import type { SigningClient } from "@evolution-sdk/evolution";
import { Address } from "@evolution-sdk/evolution";
import * as dateFns from "date-fns";

const CLEAR_LINE = "\r\x1b[K";

export async function runDevnetSession(client: SigningClient) {
  const address = await client.address();

  const genesis: Config.ShelleyGenesis = {
    ...Config.DEFAULT_SHELLEY_GENESIS,
    initialFunds: { [Address.toHex(address)]: 1_000_000_000_000 },
  };
  const cluster = await Cluster.make({
    clusterName: "cli-devnet",
    kupo: { enabled: true, port: 1442 },
    ogmios: { enabled: true, port: 1337 },
    ports: { node: 3001, submit: 3002 },
    shelleyGenesis: genesis,
  });

  let stopped = false;
  async function cleanUp() {
    if (!stopped) {
      stopped = true;
      await Cluster.stop(cluster);
      await Cluster.remove(cluster);
      process.stdout.write(CLEAR_LINE);
      console.log("✓ Devnet stopped and removed");
    }
  }

  async function servicesStatus() {
    return await Promise.all(
      (["cardanoNode", "kupo", "ogmios"] as const).map(
        async (service) =>
          // biome-ignore lint/style/noNonNullAssertion: false positive
          [service, await Container.getStatus(cluster[service]!)] as const,
      ),
    );
  }

  try {
    await Cluster.start(cluster);
    const started = Date.now();

    process.on("SIGINT", cleanUp);
    process.on("SIGQUIT", cleanUp);
    process.on("SIGTERM", cleanUp);

    process.stdout.write("Devnet starting...");
    await new Promise((r) => setTimeout(r, 5000));

    // recover old format UTxOs by sending them to the same wallet
    const genesisUtxos = await Genesis.calculateUtxosFromConfig(genesis);
    const genesisTx = await client
      .newTx()
      .sendAll({ to: address })
      .build({ availableUtxos: genesisUtxos });
    const genesisTxHash = await genesisTx.signAndSubmit();
    await client.awaitTx(genesisTxHash, 1000);

    while (!stopped) {
      for (const [service, status] of await servicesStatus()) {
        if (!status?.State.Running) {
          throw new Error(
            `service ${service} is not running: ${JSON.stringify(status)}`,
          );
        }
      }

      process.stdout.write(CLEAR_LINE);
      process.stdout.write(
        `✓ Devnet running [${dateFns.formatDistance(Date.now(), started, {
          includeSeconds: true,
        })}]`,
      );

      await new Promise((r) => setTimeout(r, 3000));
    }
  } finally {
    await cleanUp();
  }
}
