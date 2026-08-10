import { WithdrawFee } from "../governance_payload/WithdrawFee";

describe("WithdrawFee.getTotalAmount", () => {
  const target = Buffer.from(
    "d879b2c9e70ca8e4bed04223d95f45f87f33b935",
    "hex",
  );

  test("computes value * 10^expo for ordinary exponents", () => {
    expect(
      new WithdrawFee("ethereum", target, 312438908721178179n, 0n)
        .getTotalAmount(),
    ).toBe(312438908721178179n);
    expect(
      new WithdrawFee("cronos", target, 3952774000000000013n, 5n)
        .getTotalAmount(),
    ).toBe(395277400000000001300000n);
  });

  test("computes at the MAX_EXPO boundary", () => {
    expect(
      new WithdrawFee("ethereum", target, 1n, WithdrawFee.MAX_EXPO)
        .getTotalAmount(),
    ).toBe(10n ** WithdrawFee.MAX_EXPO);
  });

  test("returns undefined above MAX_EXPO instead of evaluating 10^expo", () => {
    expect(
      new WithdrawFee("ethereum", target, 1n, WithdrawFee.MAX_EXPO + 1n)
        .getTotalAmount(),
    ).toBeUndefined();
    // Full uint64 range must not hang or throw (RangeError) when displayed.
    expect(
      new WithdrawFee("ethereum", target, 1n, 2n ** 64n - 1n).getTotalAmount(),
    ).toBeUndefined();
  });

  test("round-trips a live payload and computes its amount", () => {
    // WithdrawFee instruction for zero_gravity from proposal
    // CQVZMPLeeswtAafjYiMPpsbN59wHsGd3vKh1FPfSRunA (OP-PIP-128).
    const payload = Buffer.from(
      "5054474d0109eab8d879b2c9e70ca8e4bed04223d95f45f87f33b935aedc313e09ec22390000000000000000",
      "hex",
    );
    const decoded = WithdrawFee.decode(payload);
    expect(decoded).toBeDefined();
    expect(decoded?.targetChainId).toBe("zero_gravity");
    expect(decoded?.targetAddress.toString("hex")).toBe(
      target.toString("hex"),
    );
    expect(decoded?.getTotalAmount()).toBe(12600000000000008761n);
    expect(decoded?.encode().toString("hex")).toBe(payload.toString("hex"));
  });
});
