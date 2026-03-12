import {
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  alignTimestampToChannel,
  getServerTime,
  normalizeTimestampToMicroseconds,
  unixSecondsToISO,
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

describe("unixSecondsToISO", () => {
  it("converts Unix seconds to ISO 8601 string", () => {
    expect(unixSecondsToISO(1767225600)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("converts epoch 0 correctly", () => {
    expect(unixSecondsToISO(0)).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("getServerTime", () => {
  it("returns current time as ISO and Unix seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = getServerTime();
    const after = Math.floor(Date.now() / 1000);

    expect(result.server_unix_seconds).toBeGreaterThanOrEqual(before);
    expect(result.server_unix_seconds).toBeLessThanOrEqual(after);
    expect(result.server_time_utc).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });
});

describe("DATA_AVAILABLE_FROM constants", () => {
  it("has consistent Unix/ISO values", () => {
    expect(DATA_AVAILABLE_FROM_UNIX).toBe(1743465600);
    expect(DATA_AVAILABLE_FROM_ISO).toBe("2025-04-01T00:00:00Z");
    expect(unixSecondsToISO(DATA_AVAILABLE_FROM_UNIX)).toBe(
      "2025-04-01T00:00:00.000Z",
    );
  });
});
