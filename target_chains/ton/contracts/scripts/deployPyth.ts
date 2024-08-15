import { toNano } from "@ton/core";
import { Pyth } from "../wrappers/Pyth";
import { compile, NetworkProvider } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {
  const pyth = provider.open(Pyth.createFromConfig({}, await compile("Pyth")));

  await pyth.sendDeploy(provider.sender(), toNano("0.05"));

  await provider.waitForDeploy(pyth.address);

  // run methods on `pyth`
}
