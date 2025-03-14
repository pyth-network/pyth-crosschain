const abi = require("web3-eth-abi");
const utils = require("web3-utils");
const elliptic = require("elliptic");

const testSigner1PK =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

const testGovernanceChain = "1"; // ethereum
const testGovernanceEmitter =
  "0x0000000000000000000000000000000000000000000000000000000000001234";

function zeroPadBytes(value, length) {
  while (value.length < 2 * length) {
    value = "0" + value;
  }
  return value;
}

const signAndEncodeVM = function (
  timestamp,
  nonce,
  emitterChainId,
  emitterAddress,
  sequence,
  data,
  signers,
  guardianSetIndex,
  consistencyLevel,
) {
  const body = [
    abi.encodeParameter("uint32", timestamp).substring(2 + (64 - 8)),
    abi.encodeParameter("uint32", nonce).substring(2 + (64 - 8)),
    abi.encodeParameter("uint16", emitterChainId).substring(2 + (64 - 4)),
    abi.encodeParameter("bytes32", emitterAddress).substring(2),
    abi.encodeParameter("uint64", sequence).substring(2 + (64 - 16)),
    abi.encodeParameter("uint8", consistencyLevel).substring(2 + (64 - 2)),
    data.substr(2),
  ];

  const hash = utils.soliditySha3(utils.soliditySha3("0x" + body.join("")));

  let signatures = "";

  for (let i in signers) {
    const ec = new elliptic.ec("secp256k1");
    const key = ec.keyFromPrivate(signers[i]);
    const signature = key.sign(hash.substr(2), { canonical: true });

    const packSig = [
      abi.encodeParameter("uint8", i).substring(2 + (64 - 2)),
      zeroPadBytes(signature.r.toString(16), 32),
      zeroPadBytes(signature.s.toString(16), 32),
      abi
        .encodeParameter("uint8", signature.recoveryParam)
        .substr(2 + (64 - 2)),
    ];

    signatures += packSig.join("");
  }

  const vm = [
    abi.encodeParameter("uint8", 1).substring(2 + (64 - 2)),
    abi.encodeParameter("uint32", guardianSetIndex).substring(2 + (64 - 8)),
    abi.encodeParameter("uint8", signers.length).substring(2 + (64 - 2)),

    signatures,
    body.join(""),
  ].join("");

  return vm;
};

function createVAAFromUint8Array(
  dataBuffer,
  emitterChainId,
  emitterAddress,
  sequence,
) {
  const dataHex = "0x" + dataBuffer.toString("hex");
  return (
    "0x" +
    signAndEncodeVM(
      0,
      0,
      emitterChainId,
      emitterAddress,
      sequence,
      dataHex,
      [testSigner1PK],
      0,
      0,
    )
  );
}

module.exports = function createLocalnetGovernanceVAA(dataBuffer, sequence) {
  return createVAAFromUint8Array(
    dataBuffer,
    testGovernanceChain,
    testGovernanceEmitter,
    sequence,
  );
};
