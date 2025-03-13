const { parseVaa } = require("@certusone/wormhole-sdk");
const { assert } = require("chai");

/**
 * Assert the VAA has payload equal to `expectedPayload`
 * @param {string} vaaHex
 * @param {Buffer} expectedPayload
 */
module.exports = async function assertVaaPayloadEquals(
  vaaHex,
  expectedPayload,
) {
  if (vaaHex.startsWith("0x")) {
    vaaHex = vaaHex.substring(2);
  }

  const vaaPayload = Buffer.from(parseVaa(Buffer.from(vaaHex, "hex")).payload);

  assert(
    expectedPayload.equals(vaaPayload),
    "The VAA payload is not equal to the expected payload",
  );
};
