
const { importCoreWasm, setDefaultWasm } = require("@certusone/wormhole-sdk-wasm");
setDefaultWasm("node");
const { assert } = require("chai");

module.exports = async function assertVaaPayloadEquals(vaaHexString, expectedPayloadBuffer) {
  const { parse_vaa } = await importCoreWasm();

  if (vaaHexString.startsWith("0x")) {
    vaaHexString = vaaHexString.substring(2);
  }

  const vaaPayload = Buffer.from(parse_vaa(Buffer.from(vaaHexString, 'hex')).payload);

  assert(expectedPayloadBuffer.equals(vaaPayload), "The VAA payload is not equal to the expected payload");
}
