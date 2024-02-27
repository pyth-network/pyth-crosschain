import { VAA_SIGNATURE_SIZE } from "./constants";

export function getGuardianSetIndex(vaa: Buffer) {
  return vaa.readUInt32BE(1);
}

export function trimSignatures(vaa: Buffer, n: number): Buffer {
  const currentNumSignatures = vaa[5];
  if (n > currentNumSignatures) {
    throw new Error(
      "Resulting VAA can't have more signatures than the original VAA"
    );
  }

  const trimmedVaa = Buffer.concat([
    vaa.subarray(0, 5 + n * VAA_SIGNATURE_SIZE),
    vaa.subarray(5 + currentNumSignatures * VAA_SIGNATURE_SIZE),
  ]);

  trimmedVaa[5] = n;
  return trimmedVaa;
}
