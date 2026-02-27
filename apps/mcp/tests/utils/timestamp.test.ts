import {
  alignTimestampToChannel,
  normalizeTimestampToMicroseconds,
} from "../../src/utils/timestamp.js";

describe("normalizeTimestampToMicroseconds", () => {
  it("converts seconds (10 digits) to microseconds", () => {
    const ts = 1_708_300_800; // Feb 19, 2024
    expect(normalizeTimestampToMicroseconds(ts)).toBe(ts * 1_000_000);
  });

  it("converts milliseconds (13 digits) to microseconds", () => {
    const ts = 1_708_300_800_000;
    expect(normalizeTimestampToMicroseconds(ts)).toBe(ts * 1000);
  });

  it("passes microseconds (16 digits) through unchanged", () => {
    const ts = 1_708_300_800_000_000;
    expect(normalizeTimestampToMicroseconds(ts)).toBe(ts);
  });

  it("handles small timestamps (e.g. epoch year 2001) as seconds", () => {
    const ts = 1_000_000_000; // Sep 2001
    expect(normalizeTimestampToMicroseconds(ts)).toBe(ts * 1_000_000);
  });

  it("handles boundary between seconds and milliseconds (11 digits) as ms", () => {
    const ts = 10_000_000_000; // 11 digits — this is actually seconds (year 2286) but >10 digits
    // 11 digits falls into ms range (<=13)
    expect(normalizeTimestampToMicroseconds(ts)).toBe(ts * 1000);
  });
});

describe("alignTimestampToChannel", () => {
  it("rounds down to nearest 200,000us for fixed_rate@200ms", () => {
    // 1708300800000000 + 150000 = not aligned
    const ts = 1_708_300_800_150_000;
    expect(alignTimestampToChannel(ts, "fixed_rate@200ms")).toBe(
      1_708_300_800_000_000,
    );
  });

  it("rounds down to nearest 50,000us for fixed_rate@50ms", () => {
    const ts = 1_708_300_800_030_000; // 30,000us offset — not aligned to 50,000
    expect(alignTimestampToChannel(ts, "fixed_rate@50ms")).toBe(
      1_708_300_800_000_000,
    );
  });

  it("passes through unchanged for real_time channel", () => {
    const ts = 1_708_300_800_123_456;
    expect(alignTimestampToChannel(ts, "real_time")).toBe(ts);
  });

  it("returns same value when already aligned", () => {
    const ts = 1_708_300_800_200_000; // divisible by 200,000
    expect(alignTimestampToChannel(ts, "fixed_rate@200ms")).toBe(ts);
  });

  it("returns timestamp unchanged for fixed_rate@0ms (zero interval)", () => {
    const ts = 1_708_300_800_123_456;
    expect(alignTimestampToChannel(ts, "fixed_rate@0ms")).toBe(ts);
  });
});
