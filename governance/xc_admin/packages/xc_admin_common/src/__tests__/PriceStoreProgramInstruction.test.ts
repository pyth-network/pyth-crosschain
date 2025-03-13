import { PublicKey } from "@solana/web3.js";
import {
  createPriceStoreInstruction,
  parsePriceStoreInstruction,
  PriceStoreInstruction,
} from "../price_store";

test("Price store instruction parse: roundtrip", (done) => {
  const items: PriceStoreInstruction[] = [
    {
      type: "Initialize",
      data: {
        payerKey: new PublicKey("Fe9vtgwRhbMSUsAjwUzupzRoJKofyyk1Rz8ZUrPmGHMr"),
        authorityKey: new PublicKey(
          "D9rnZSLjdYboFGDGHk5Qre2yBS8HYbc6374Zm6AeC1PB",
        ),
      },
    },
    {
      type: "InitializePublisher",
      data: {
        authorityKey: new PublicKey(
          "D9rnZSLjdYboFGDGHk5Qre2yBS8HYbc6374Zm6AeC1PB",
        ),
        publisherKey: new PublicKey(
          "EXAyN9UVu1x163PQkVzyNm4YunNkMGu5Ry7ntoyyQGTe",
        ),
        bufferKey: new PublicKey(
          "7q6SS575jGDjE8bWsx4PiLVqS7cHJhjJBhysvRoP53WJ",
        ),
      },
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
