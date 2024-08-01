import { CompilerConfig } from "@ton/blueprint";

export const compile: CompilerConfig = {
  lang: "func",
  targets: ["contracts/Pyth.fc", "contracts/Wormhole.fc"],
};
