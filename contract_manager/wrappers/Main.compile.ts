import { CompilerConfig } from "@ton/blueprint";

export const compile: CompilerConfig = {
  lang: "func",
  targets: [
    "../target_chains/ton/contracts/contracts/Main.fc",
    "../target_chains/ton/contracts/contracts/Pyth.fc",
    "../target_chains/ton/contracts/contracts/Wormhole.fc",
  ],
};
