import { PublicKey } from "@solana/web3.js";
import type { PriceStoreInstruction } from "../price_store";
import {
  createPriceStoreInstruction,
  parsePriceStoreInstruction,
} from "../price_store";

test("Price store instruction parse: roundtrip", (done) => {
  const items: PriceStoreInstruction[] = [
    {
      data: {
        authorityKey: new PublicKey(
          "D9rnZSLjdYboFGDGHk5Qre2yBS8HYbc6374Zm6AeC1PB",
        ),
        payerKey: new PublicKey("Fe9vtgwRhbMSUsAjwUzupzRoJKofyyk1Rz8ZUrPmGHMr"),
      },
      type: "Initialize",
    },
    {
      data: {
        authorityKey: new PublicKey(
          "D9rnZSLjdYboFGDGHk5Qre2yBS8HYbc6374Zm6AeC1PB",
        ),
        bufferKey: new PublicKey(
          "7q6SS575jGDjE8bWsx4PiLVqS7cHJhjJBhysvRoP53WJ",
        ),
        publisherKey: new PublicKey(
          "EXAyN9UVu1x163PQkVzyNm4YunNkMGu5Ry7ntoyyQGTe",
        ),
      },
      type: "InitializePublisher",
    },
  ];
  for (const data of items) {
    const instruction = createPriceStoreInstruction(data);
    const parsed = parsePriceStoreInstruction(instruction);
    expect(parsed).toStrictEqual(data);

    instruction.programId = new PublicKey(instruction.programId.toBuffer());
    const parsed2 = parsePriceStoreInstruction(instruction);
    expect(parsed2).toStrictEqual(data);
  }
  done();
});
