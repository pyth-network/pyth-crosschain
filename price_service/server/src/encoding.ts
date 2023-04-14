// Utilities for encoding VAAs for specific target chains

// List of all possible target chains. Note that "default" is an option because we need at least one chain
// with a base64 encoding (which is the old default behavior of all API methods).
export type TargetChain = "evm" | "cosmos" | "aptos" | "sui" | "default";
export const validTargetChains = ["evm", "cosmos", "aptos", "sui", "default"];
export const defaultTargetChain: TargetChain = "default";

// Possible encodings of the binary VAA data as a string.
// "0x" is the same as "hex" with a leading "0x" prepended to the hex string.
export type VaaEncoding = "base64" | "hex" | "0x";
export const defaultVaaEncoding: VaaEncoding = "base64";
export const chainToEncoding: Record<TargetChain, VaaEncoding> = {
  evm: "0x",
  cosmos: "base64",
  aptos: "base64",
  sui: "base64",
  default: "base64",
};

// Given a VAA represented as either a string in base64 or a Buffer, encode it as a string
// appropriate for the given targetChain.
export function encodeVaaForChain(
  vaa: string | Buffer,
  targetChain: TargetChain
): string {
  const encoding = chainToEncoding[targetChain];

  let vaaBuffer: Buffer;
  if (typeof vaa === "string") {
    if (encoding === defaultVaaEncoding) {
      return vaa;
    } else {
      vaaBuffer = Buffer.from(vaa, defaultVaaEncoding as BufferEncoding);
    }
  } else {
    vaaBuffer = vaa;
  }

  switch (encoding) {
    case "0x":
      return "0x" + vaaBuffer.toString("hex");
    default:
      return vaaBuffer.toString(encoding);
  }
}
