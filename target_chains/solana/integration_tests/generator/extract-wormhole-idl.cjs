// Extract the wormhole IDL from the TypeScript file to JSON format.
const fs = require("fs");
const path = require("path");

const tsPath = path.resolve(
  __dirname,
  "../../sdk/js/pyth_solana_receiver/src/idl/wormhole_core_bridge_solana.ts"
);
const content = fs.readFileSync(tsPath, "utf8");

const match = content.match(
  /export const IDL: WormholeCoreBridgeSolana = (\{[\s\S]*\});?\s*$/
);
if (!match) {
  console.error("Failed to extract IDL from wormhole_core_bridge_solana.ts");
  process.exit(1);
}

// The TS object literal is valid JS, so we can eval it safely here
const idl = eval("(" + match[1] + ")");
const outPath = path.resolve(__dirname, "idl", "wormhole_core_bridge_solana.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(idl, null, 2));
console.log("Extracted wormhole IDL to", outPath);
