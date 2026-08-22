import { SetFee } from "../governance_payload/SetFee";

describe("SetFee.getNewFeeAmount", () => {
  test("computes newFeeValue * 10^newFeeExpo for ordinary exponents", () => {
    expect(new SetFee("ethereum", 4000000000000n, 0n).getNewFeeAmount()).toBe(
      4000000000000n,
    );
    expect(new SetFee("cronos", 2n, 17n).getNewFeeAmount()).toBe(
      200000000000000000n,
    );
  });

  test("computes at the MAX_EXPO boundary", () => {
    expect(new SetFee("ethereum", 1n, SetFee.MAX_EXPO).getNewFeeAmount()).toBe(
      10n ** SetFee.MAX_EXPO,
    );
  });

  test("returns undefined above MAX_EXPO instead of evaluating 10^expo", () => {
    expect(
      new SetFee("ethereum", 1n, SetFee.MAX_EXPO + 1n).getNewFeeAmount(),
    ).toBeUndefined();
    // Full uint64 range must not hang or throw (RangeError) when displayed.
    expect(
      new SetFee("ethereum", 1n, 2n ** 64n - 1n).getNewFeeAmount(),
    ).toBeUndefined();
  });

  test("round-trips a live payload and computes its amount", () => {
    // SetFee instruction for abstract from proposal
    // CQVZMPLeeswtAafjYiMPpsbN59wHsGd3vKh1FPfSRunA (OP-PIP-128).
    const payload = Buffer.from(
      "5054474d0103eaa700000000000000000000000000000000",
      "hex",
    );
    const decoded = SetFee.decode(payload);
    expect(decoded).toBeDefined();
    expect(decoded?.targetChainId).toBe("abstract");
    expect(decoded?.getNewFeeAmount()).toBe(0n);
    expect(decoded?.encode().toString("hex")).toBe(payload.toString("hex"));
  });
});
