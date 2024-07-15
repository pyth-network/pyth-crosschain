/** ABI of the Pyth contract. Pass it as the first argument of `new Contract()` when using starknet-js. */
export { default as PYTH_ABI } from "./abi/pyth.json";
/** ABI of the ERC20 contract. Pass it as the first argument of `new Contract()` when using starknet-js. */
export { default as ERC20_ABI } from "./abi/erc20.json";

/** Address of the ERC20 contract that Pyth uses to accept fees in STRK. */
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** Address of the ERC20 contract that Pyth uses to accept fees in ETH. */
export const ETH_TOKEN_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

/** Address of the Pyth contract on Starknet Sepolia (testnet). */
export const PYTH_CONTRACT_ADDRESS_SEPOLIA =
  "0x07f2b07b6b5365e7ee055bda4c0ecabd867e6d3ee298d73aea32b027667186d6";

/** Address of the Pyth contract on Starknet mainnet. */
export const PYTH_CONTRACT_ADDRESS_MAINNET =
  "0x062ab68d8e23a7aa0d5bf4d25380c2d54f2dd8f83012e047851c3706b53d64d1";

/** A byte array encoded in a format compatible with starknet-js and with the Pyth contract. */
export class ByteBuffer {
  num_last_bytes = 0;
  data: string[] = [];

  /** Create a `ByteBuffer` from an array of `bytes31`.
   * - Use `ByteBuffer::fromBuffer` to create `ByteBuffer` from a `Buffer`.
   * - Use `ByteBuffer::fromBase64` to create `ByteBuffer` from Base64 representation of binary data.
   * - Use `ByteBuffer::fromHex` to create `ByteBuffer` from HEX representation of binary data.
   */
  constructor(num_last_bytes: number, data: string[]) {
    this.num_last_bytes = num_last_bytes;
    this.data = data;
  }

  /** Create a `ByteBuffer` from HEX representation of binary data. */
  public static fromHex(hexData: string): ByteBuffer {
    return ByteBuffer.fromBuffer(Buffer.from(hexData, "hex"));
  }

  /** Create a `ByteBuffer` from Base64 representation of binary data. */
  public static fromBase64(hexData: string): ByteBuffer {
    return ByteBuffer.fromBuffer(Buffer.from(hexData, "base64"));
  }

  /** Create a `ByteBuffer` from a `Buffer`. */
  public static fromBuffer(buffer: Buffer): ByteBuffer {
    let pos = 0;
    const data = [];
    while (pos < buffer.length) {
      if (pos + 31 <= buffer.length) {
        const slice = buffer.subarray(pos, pos + 31);
        data.push("0x" + slice.toString("hex"));
      } else {
        const slice = buffer.subarray(pos);
        data.push("0x" + slice.toString("hex"));
        return new ByteBuffer(buffer.length - pos, data);
      }
      pos += 31;
    }
    return new ByteBuffer(data.length == 0 ? 0 : 31, data);
  }
}
