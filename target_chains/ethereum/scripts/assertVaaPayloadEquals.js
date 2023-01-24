const {
  importCoreWasm,
  setDefaultWasm,
} = require("@certusone/wormhole-sdk-wasm");
setDefaultWasm("node");
const { assert } = require("chai");

/**
 * Assert the VAA has payload equal to `expectedPayload`
 * @param {string} vaaHex
 * @param {Buffer} expectedPayload
 */
module.exports = async function assertVaaPayloadEquals(
  vaaHex,
  expectedPayload
) {
  const { parse_vaa } = await importCoreWasm();

  if (vaaHex.startsWith("0x")) {
    vaaHex = vaaHex.substring(2);
  }

  const vaaPayload = Buffer.from(parse_vaa(Buffer.from(vaaHex, "hex")).payload);

  assert(
    expectedPayload.equals(vaaPayload),
    "The VAA payload is not equal to the expected payload"
  );
};
