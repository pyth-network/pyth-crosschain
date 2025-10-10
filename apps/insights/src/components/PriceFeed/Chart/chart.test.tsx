import type { LineData, UTCTimestamp } from "lightweight-charts";

import { mergeData, startOfResolution } from "./chart";

describe("mergeData", () => {
  it("merges two arrays with no overlap", () => {
    const a: LineData[] = [
      { time: 1000 as UTCTimestamp, value: 10 },
      { time: 2000 as UTCTimestamp, value: 20 },
    ];
    const b: LineData[] = [
      { time: 3000 as UTCTimestamp, value: 30 },
      { time: 4000 as UTCTimestamp, value: 40 },
    ];

    const result = mergeData(a, b);

    expect(result).toEqual([
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
      { time: 3000, value: 30 },
      { time: 4000, value: 40 },
    ]);
  });

  it("deduplicates by time, keeping the second value", () => {
    const a: LineData[] = [
      { time: 1000 as UTCTimestamp, value: 10 },
      { time: 2000 as UTCTimestamp, value: 20 },
    ];
    const b: LineData[] = [
      { time: 2000 as UTCTimestamp, value: 99 },
      { time: 3000 as UTCTimestamp, value: 30 },
    ];

    const result = mergeData(a, b);

    expect(result).toEqual([
      { time: 1000, value: 10 },
      { time: 2000, value: 99 }, // second value overwrites first
      { time: 3000, value: 30 },
    ]);
  });

  it("sorts the merged array by time", () => {
    const a: LineData[] = [
      { time: 3000 as UTCTimestamp, value: 30 },
      { time: 1000 as UTCTimestamp, value: 10 },
    ];
    const b: LineData[] = [
      { time: 4000 as UTCTimestamp, value: 40 },
      { time: 2000 as UTCTimestamp, value: 20 },
    ];

    const result = mergeData(a, b);

    expect(result).toEqual([
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
      { time: 3000, value: 30 },
      { time: 4000, value: 40 },
    ]);
  });

  it("handles empty first array", () => {
    const a: LineData[] = [];
    const b: LineData[] = [
      { time: 1000 as UTCTimestamp, value: 10 },
      { time: 2000 as UTCTimestamp, value: 20 },
    ];

    const result = mergeData(a, b);

    expect(result).toEqual([
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
    ]);
  });

  it("handles empty second array", () => {
    const a: LineData[] = [
      { time: 1000 as UTCTimestamp, value: 10 },
      { time: 2000 as UTCTimestamp, value: 20 },
    ];
    const b: LineData[] = [];

    const result = mergeData(a, b);

    expect(result).toEqual([
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
    ]);
  });

  it("handles both arrays empty", () => {
    const a: LineData[] = [];
    const b: LineData[] = [];

    const result = mergeData(a, b);

    expect(result).toEqual([]);
  });
});

describe("startOfResolution", () => {
  it("returns start of second for 1s resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");
    const result = startOfResolution(date, "1s");

    expect(result).toBe(new Date("2024-01-15T10:30:45.000Z").getTime());
  });

  it("returns start of minute for 1m resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");
    const result = startOfResolution(date, "1m");

    expect(result).toBe(new Date("2024-01-15T10:30:00.000Z").getTime());
  });

  it("returns start of minute for 5m resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");
    const result = startOfResolution(date, "5m");

    expect(result).toBe(new Date("2024-01-15T10:30:00.000Z").getTime());
  });

  it("returns start of hour for 1H resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");
    const result = startOfResolution(date, "1H");

    expect(result).toBe(new Date("2024-01-15T10:00:00.000Z").getTime());
  });

  it("returns start of day for 1D resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");
    const result = startOfResolution(date, "1D");

    expect(result).toBe(new Date("2024-01-15T00:00:00.000Z").getTime());
  });

  it("throws error for unknown resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");

    expect(() => startOfResolution(date, "15m")).toThrow(
      "Unknown resolution: 15m",
    );
  });

  it("throws error for invalid resolution", () => {
    const date = new Date("2024-01-15T10:30:45.678Z");

    expect(() => startOfResolution(date, "invalid")).toThrow(
      "Unknown resolution: invalid",
    );
  });
});
