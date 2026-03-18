import { Data } from "@evolution-sdk/evolution";
import { execFileAsync } from "./utils.js";

async function pythLazerCardanoEval(
  dir: string | undefined,
  module: string,
  name: string,
  args: string[],
  { env }: { env?: string },
): Promise<string> {
  const { stdout } = await execFileAsync("cargo", [
    "run",
    "--bin",
    "pyth_lazer_cardano",
    "--",
    ...(dir ? ["--dir", dir] : []),
    ...(env ? ["--env", env] : []),
    "eval",
    module,
    name,
    ...args,
  ]);
  return stdout.trim();
}

export async function aikenEval(
  dir: string | undefined,
  module: string,
  name: string,
  args: Data.Data[],
  opts: { env?: string } = {},
): Promise<Data.Data> {
  const output = await pythLazerCardanoEval(
    dir,
    module,
    name,
    args.map((arg) => Data.toCBORHex(arg)),
    opts,
  );
  return Data.fromCBORHex(output);
}
