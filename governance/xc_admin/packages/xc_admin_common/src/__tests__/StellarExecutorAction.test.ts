import { toChainId } from "../chains";
import {
  CallStellarExecutor,
  decodeGovernancePayload,
  MAGIC_NUMBER,
  MODULE_STELLAR_EXECUTOR,
  PythGovernanceHeader,
  StellarExecutorAction,
  UpgradeStellarExecutor,
} from "../governance_payload";

// A 56-character Soroban contract id (testnet Lazer verifier).
const VERIFIER = "CCE62RN3NUTNMD2SQ2EGWRJ6XHL7RUYQBNCEK7LVGFRLPCW7U7FGACM5";
const EXECUTOR = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function expectHeader(buffer: Buffer, action: number) {
  // Magic "PTGM" is MAGIC_NUMBER serialized little-endian (u32).
  expect(buffer.readUInt32LE(0)).toBe(MAGIC_NUMBER);
  expect(buffer.subarray(0, 4).toString("utf8")).toBe("PTGM");
  expect(buffer[4]).toBe(MODULE_STELLAR_EXECUTOR);
  expect(buffer[5]).toBe(action);
  expect(buffer.readUInt16BE(6)).toBe(toChainId("stellar_testnet"));
}

describe("StellarExecutorAction", () => {
  test("Call encodes the header, length-prefixed addresses, function and args", () => {
    // ScVec([BytesN<33>, u64]) for update_trusted_signer — the exact XDR is
    // produced by the Stellar SDK in the contract manager; here we only assert
    // the framing wraps whatever args buffer it is given.
    const argsXdr = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const action = new CallStellarExecutor(
      "stellar_testnet",
      EXECUTOR,
      VERIFIER,
      "update_trusted_signer",
      argsXdr,
    );
    const buffer = action.encode();

    expectHeader(buffer, StellarExecutorAction.Call);

    let offset = PythGovernanceHeader.span;
    expect(buffer[offset]).toBe(EXECUTOR.length);
    offset += 1;
    expect(buffer.subarray(offset, offset + EXECUTOR.length).toString()).toBe(
      EXECUTOR,
    );
    offset += EXECUTOR.length;
    expect(buffer[offset]).toBe(VERIFIER.length);
    offset += 1;
    expect(buffer.subarray(offset, offset + VERIFIER.length).toString()).toBe(
      VERIFIER,
    );
    offset += VERIFIER.length;
    expect(buffer[offset]).toBe("update_trusted_signer".length);
    offset += 1 + "update_trusted_signer".length;
    expect(buffer.subarray(offset)).toEqual(argsXdr);
  });

  test("Call round-trips through decode", () => {
    const argsXdr = Buffer.from([9, 9, 9]);
    const original = new CallStellarExecutor(
      "stellar_testnet",
      EXECUTOR,
      VERIFIER,
      "ping",
      argsXdr,
    );
    const decoded = CallStellarExecutor.decode(original.encode());
    expect(decoded).toBeDefined();
    expect(decoded?.targetChainId).toBe("stellar_testnet");
    expect(decoded?.executor).toBe(EXECUTOR);
    expect(decoded?.targetContract).toBe(VERIFIER);
    expect(decoded?.functionName).toBe("ping");
    expect(decoded?.argsXdr).toEqual(argsXdr);
  });

  test("decodeGovernancePayload resolves a Stellar Call", () => {
    const action = new CallStellarExecutor(
      "stellar_testnet",
      EXECUTOR,
      VERIFIER,
      "ping",
      Buffer.alloc(0),
    );
    const decoded = decodeGovernancePayload(action.encode());
    expect(decoded).toBeInstanceOf(CallStellarExecutor);
  });

  test("Call rejects an over-long function name", () => {
    const action = new CallStellarExecutor(
      "stellar_testnet",
      EXECUTOR,
      VERIFIER,
      "a".repeat(33),
      Buffer.alloc(0),
    );
    expect(() => action.encode()).toThrow();
  });

  test("UpgradeExecutor round-trips and targets the executor itself", () => {
    const wasmDigest = Buffer.alloc(32, 0xab);
    const original = new UpgradeStellarExecutor(
      "stellar_testnet",
      EXECUTOR,
      wasmDigest,
    );
    const buffer = original.encode();
    expectHeader(buffer, StellarExecutorAction.UpgradeExecutor);

    const decoded = UpgradeStellarExecutor.decode(buffer);
    expect(decoded).toBeDefined();
    expect(decoded?.executor).toBe(EXECUTOR);
    expect(decoded?.wasmDigest).toEqual(wasmDigest);
    expect(decodeGovernancePayload(buffer)).toBeInstanceOf(
      UpgradeStellarExecutor,
    );
  });

  test("UpgradeExecutor rejects a wrong-length digest", () => {
    expect(
      () =>
        new UpgradeStellarExecutor(
          "stellar_testnet",
          EXECUTOR,
          Buffer.alloc(31),
        ),
    ).toThrow();
  });
});
