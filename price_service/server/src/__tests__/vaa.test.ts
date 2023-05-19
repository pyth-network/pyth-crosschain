import { isValidVaa } from "../vaa";
import { GuardianSignature, parseVaa } from "@certusone/wormhole-sdk";
import { randomBytes } from "crypto";

const VAA = Buffer.from(
  "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",
  "base64"
);

describe("VAA validation works", () => {
  test("with valid signatures", async () => {
    let parsedVaa = parseVaa(VAA);

    expect(isValidVaa(parsedVaa, "mainnet")).toBe(true);
  });

  test("with a wrong address", async () => {
    let parsedVaa = parseVaa(VAA);
    const vaaIndex = 8;
    const setIndex1 = 4;
    const setIndex2 = 5;

    // Replace the signature from guardian at setIndex1 with the one from
    // setIndex2.
    parsedVaa.guardianSignatures[vaaIndex] = {
      index: setIndex1,
      signature: parsedVaa.guardianSignatures[setIndex2].signature,
    };

    expect(isValidVaa(parsedVaa, "mainnet")).toBe(false);
  });

  test("with an invalid signature", async () => {
    let parsedVaa = parseVaa(VAA);
    const vaaIndex = 8;
    const setIndex = 4;

    // Inject a random buffer as the signature of the guardian at setIndex.
    parsedVaa.guardianSignatures[vaaIndex] = {
      index: setIndex,
      signature: randomBytes(65), // invalid signature
    };

    expect(isValidVaa(parsedVaa, "mainnet")).toBe(false);
  });
});
