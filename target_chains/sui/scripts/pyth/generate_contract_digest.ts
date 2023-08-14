import "xc_admin_common";
import { execSync } from "child_process";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --path <path-to-contracts>")
  .options({
    path: {
      type: "string",
      default: "../../contracts",
      desc: "Path to the sui contracts, will use ../../contracts by default",
    },
  });

async function main() {
  const argv = await parser.argv;
  const buildOutput: {
    modules: string[];
    dependencies: string[];
    digest: number[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 --path ${__dirname}/${argv.path} 2> /dev/null`,
      {
        encoding: "utf-8",
      }
    )
  );
  console.log("Contract digest:");
  console.log(Buffer.from(buildOutput.digest).toString("hex"));
}

main();
