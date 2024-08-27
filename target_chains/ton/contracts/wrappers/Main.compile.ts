import { CompilerConfig } from "@ton/blueprint";

export const compile: CompilerConfig = {
  lang: "func",
  targets: ["contracts/Main.fc", "contracts/Pyth.fc", "contracts/Wormhole.fc"],
};
