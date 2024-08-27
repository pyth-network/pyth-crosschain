import { toNano } from "@ton/core";
import { Main } from "../wrappers/Main";
import { compile, NetworkProvider } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {
  const main = provider.open(Main.createFromConfig({}, await compile("Main")));

  await main.sendDeploy(provider.sender(), toNano("0.05"));

  await provider.waitForDeploy(main.address);

  // run methods on `main`
}
