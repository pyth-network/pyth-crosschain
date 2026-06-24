import { describeDay, parseSchedule } from "./schedule";

describe("parseSchedule", () => {
  it("parses a 24/7 schedule (crypto)", () => {
    const parsed = parseSchedule("America/New_York;O,O,O,O,O,O,O;");
    expect(parsed).not.toBeNull();
    expect(parsed?.timezone).toBe("America/New_York");
    expect(parsed?.week).toHaveLength(7);
    expect(parsed?.week.every((day) => day.kind === "open")).toBe(true);
    expect(parsed?.holidays).toHaveLength(0);
  });

  it("parses weekday ranges, weekend closed, and holiday overrides (equity)", () => {
    const parsed = parseSchedule(
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1127/0930-1300,1225/C",
    );
    expect(parsed?.week[0]).toEqual({
      kind: "ranges",
      ranges: [{ close: "16:00", open: "09:30" }],
    });
    expect(parsed?.week[5]).toEqual({ kind: "closed" });
    expect(parsed?.week[6]).toEqual({ kind: "closed" });
    expect(parsed?.holidays).toHaveLength(2);
    expect(parsed?.holidays[0]).toMatchObject({
      label: "Nov 27",
      monthDay: "1127",
    });
    expect(parsed?.holidays[1]).toMatchObject({
      label: "Dec 25",
      monthDay: "1225",
      schedule: { kind: "closed" },
    });
  });

  it("handles &-joined ranges and the 2400 end-of-day token", () => {
    const parsed = parseSchedule(
      "America/New_York;0000-0400&2000-2400,O,O,O,O,C,C;",
    );
    expect(parsed?.week[0]).toEqual({
      kind: "ranges",
      ranges: [
        { close: "04:00", open: "00:00" },
        { close: "24:00", open: "20:00" },
      ],
    });
  });

  it("parses a slash-less timezone with a reduced Sunday (Tel-Aviv)", () => {
    const parsed = parseSchedule(
      "Israel;0959-1714,0959-1714,0959-1714,0959-1714,C,C,0959-1539;",
    );
    expect(parsed?.timezone).toBe("Israel");
    expect(parsed?.week[4]).toEqual({ kind: "closed" }); // Friday
    expect(parsed?.week[6]).toEqual({
      kind: "ranges",
      ranges: [{ close: "15:39", open: "09:59" }],
    }); // Sunday
  });

  it("falls back (null) on the deprecated comma-delimited weekly_schedule", () => {
    expect(parseSchedule("Europe/Lisbon,O,O,O,O,O,C,C")).toBeNull();
  });

  it("falls back (null) on malformed input", () => {
    expect(parseSchedule("America/New_York;O,O,O;")).toBeNull(); // wrong day count
    expect(parseSchedule("America/New_York;2530-1600,O,O,O,O,C,C;")).toBeNull(); // bad hour
    expect(parseSchedule("America/New_York")).toBeNull(); // missing segments
    expect(parseSchedule("America/New_York;O,O,O,O,O,C,C;13/C")).toBeNull(); // bad MonthDay
  });

  it("describeDay renders each kind", () => {
    expect(describeDay({ kind: "open" })).toBe("Open 24h");
    expect(describeDay({ kind: "closed" })).toBe("Closed");
    expect(
      describeDay({
        kind: "ranges",
        ranges: [{ close: "16:00", open: "09:30" }],
      }),
    ).toBe("09:30 to 16:00");
  });
});
