import type { ChainName } from "../chains";
import { safeBufferConcat } from "../utils/buffer";
import {
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";

// Soroban `Symbol` maximum length, in bytes. Mirrors `MAX_SYMBOL_LEN` in the
// Stellar executor's `governance.rs`.
const MAX_SYMBOL_LEN = 32;

// Stellar addresses are variable-length strkey strings (e.g. a 56-character
// contract id starting with `C`). The executor reads them with
// `Address::from_string_bytes`, so each address is serialized as its raw strkey
// *string* bytes, length-prefixed with a single byte — not the decoded 32-byte
// key. See `wormhole-executor-stellar/src/governance.rs`.
function encodeLengthPrefixed(value: Buffer): Buffer {
  if (value.length === 0 || value.length > 0xff) {
    throw new Error(
      `Length-prefixed field must be 1..=255 bytes, got ${value.length}`,
    );
  }
  return safeBufferConcat([Buffer.from([value.length]), value]);
}

// Read a `[u8 len][len bytes]` field starting at `offset`; returns the bytes and
// the offset just past them.
function decodeLengthPrefixed(
  data: Buffer,
  offset: number,
): { value: Buffer; offset: number } {
  if (offset >= data.length) {
    throw new Error("Truncated length-prefixed field");
  }
  const len = data.readUInt8(offset);
  const start = offset + 1;
  const end = start + len;
  if (len === 0 || end > data.length) {
    throw new Error("Truncated length-prefixed field");
  }
  return { offset: end, value: data.subarray(start, end) };
}

/**
 * Generic governance call dispatched by the Stellar wormhole executor
 * (`MODULE_STELLAR_EXECUTOR`, action `Call`).
 *
 * Wire format (after the 8-byte governance header):
 * ```text
 * [1 byte]  executor strkey length
 * [N bytes] executor strkey (must equal the deployed executor contract id)
 * [1 byte]  target strkey length
 * [M bytes] target strkey (contract the executor invokes)
 * [1 byte]  function name length (1..=32, valid Soroban Symbol)
 * [F bytes] function name (UTF-8)
 * [rest]    XDR-encoded ScVec of call arguments
 * ```
 *
 * `argsXdr` is the XDR serialization of the argument vector that the target
 * function expects — produced with the Stellar SDK in the contract manager,
 * since this package is intentionally free of Soroban SDK dependencies. For
 * example, "update trusted signer" is expressed as
 * `Call(target = verifier, functionName = "update_trusted_signer",
 * argsXdr = ScVec([pubkey: BytesN<33>, expiresAt: u64]))`.
 */
export class CallStellarExecutor extends PythGovernanceActionImpl {
  constructor(
    targetChainId: ChainName,
    readonly executor: string,
    readonly targetContract: string,
    readonly functionName: string,
    readonly argsXdr: Buffer,
  ) {
    super(targetChainId, "Call");
  }

  static decode(data: Buffer): CallStellarExecutor | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "Call") return undefined;

    try {
      let offset = PythGovernanceHeader.span;
      const executor = decodeLengthPrefixed(data, offset);
      offset = executor.offset;
      const target = decodeLengthPrefixed(data, offset);
      offset = target.offset;
      const fn = decodeLengthPrefixed(data, offset);
      offset = fn.offset;
      const argsXdr = data.subarray(offset);

      return new CallStellarExecutor(
        header.targetChainId,
        executor.value.toString("utf8"),
        target.value.toString("utf8"),
        fn.value.toString("utf8"),
        argsXdr,
      );
    } catch {
      return undefined;
    }
  }

  encode(): Buffer {
    const functionName = Buffer.from(this.functionName, "utf8");
    if (functionName.length === 0 || functionName.length > MAX_SYMBOL_LEN) {
      throw new Error(
        `Function name must be 1..=${MAX_SYMBOL_LEN} bytes, got ${functionName.length}`,
      );
    }
    return safeBufferConcat([
      this.header().encode(),
      encodeLengthPrefixed(Buffer.from(this.executor, "utf8")),
      encodeLengthPrefixed(Buffer.from(this.targetContract, "utf8")),
      encodeLengthPrefixed(functionName),
      this.argsXdr,
    ]);
  }
}

/**
 * Self-upgrade of the Stellar wormhole executor
 * (`MODULE_STELLAR_EXECUTOR`, action `UpgradeExecutor`).
 *
 * Wire format (after the 8-byte governance header):
 * ```text
 * [1 byte]  executor strkey length
 * [N bytes] executor strkey
 * [1 byte]  target strkey length
 * [M bytes] target strkey (must equal the executor — self-upgrade)
 * [32 bytes] new WASM digest
 * ```
 */
export class UpgradeStellarExecutor extends PythGovernanceActionImpl {
  readonly wasmDigest: Buffer;

  constructor(
    targetChainId: ChainName,
    readonly executor: string,
    wasmDigest: Buffer,
  ) {
    super(targetChainId, "UpgradeExecutor");
    if (wasmDigest.length !== 32) {
      throw new Error(`WASM digest must be 32 bytes, got ${wasmDigest.length}`);
    }
    this.wasmDigest = wasmDigest;
  }

  static decode(data: Buffer): UpgradeStellarExecutor | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "UpgradeExecutor") return undefined;

    try {
      let offset = PythGovernanceHeader.span;
      const executor = decodeLengthPrefixed(data, offset);
      offset = executor.offset;
      const target = decodeLengthPrefixed(data, offset);
      offset = target.offset;
      const wasmDigest = data.subarray(offset);
      if (wasmDigest.length !== 32) return undefined;

      return new UpgradeStellarExecutor(
        header.targetChainId,
        executor.value.toString("utf8"),
        Buffer.from(wasmDigest),
      );
    } catch {
      return undefined;
    }
  }

  encode(): Buffer {
    const executor = Buffer.from(this.executor, "utf8");
    return safeBufferConcat([
      this.header().encode(),
      encodeLengthPrefixed(executor),
      // Self-upgrade: the target contract is the executor itself.
      encodeLengthPrefixed(executor),
      this.wasmDigest,
    ]);
  }
}
