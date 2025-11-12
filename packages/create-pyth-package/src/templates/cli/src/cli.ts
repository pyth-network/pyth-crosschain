import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

import { setupHelloWorldCommand } from "./commands/hello-world-cmd.js";

async function setupCLI() {
  let yargs = createCLI(hideBin(process.argv));
  yargs = setupHelloWorldCommand(yargs);

  const { _ } = await yargs.help().argv;

  if (_.length === 0) {
    yargs.showHelp();
    return;
  }
}

setupCLI();
