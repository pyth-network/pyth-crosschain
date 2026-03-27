"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CHANNEL_RATES,
  CHANNELS,
  MIN_CHANNEL_TO_NUMBER,
  ROW_SIZE_ESTIMATE,
} from "../../lib/channels";
import type { Feed } from "../../lib/validate";

const ALL_COLUMNS = [
  { default: true, group: "Price", label: "Price", value: "price" },
  { default: true, group: "Price", label: "Best Bid", value: "best_bid_price" },
  { default: true, group: "Price", label: "Best Ask", value: "best_ask_price" },
  { default: false, group: "Price", label: "EMA Price", value: "ema_price" },
  {
    default: false,
    group: "Price",
    label: "EMA Confidence",
    value: "ema_confidence",
  },
  {
    default: false,
    group: "Metadata",
    label: "Confidence",
    value: "confidence",
  },
  {
    default: false,
    group: "Metadata",
    label: "Publisher Count",
    value: "publisher_count",
  },
  { default: false, group: "Metadata", label: "Exponent", value: "exponent" },
  {
    default: false,
    group: "Metadata",
    label: "Market Session",
    value: "market_session",
  },
  { default: false, group: "Metadata", label: "State", value: "state" },
  {
    default: false,
    group: "Funding",
    label: "Funding Rate",
    value: "funding_rate",
  },
  {
    default: false,
    group: "Funding",
    label: "Funding Timestamp",
    value: "funding_timestamp",
  },
  {
    default: false,
    group: "Funding",
    label: "Funding Interval (μs)",
    value: "funding_rate_interval_us",
  },
];

function feedSupportsChannel(feed: Feed, channel: number): boolean {
  if (!feed.min_channel) return true;
  const minChannelNum = MIN_CHANNEL_TO_NUMBER[feed.min_channel];
  if (minChannelNum === undefined) return true;
  return channel >= minChannelNum;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRows(rows: number): string {
  if (rows < 1000) return rows.toString();
  if (rows < 1_000_000) return `${(rows / 1000).toFixed(1)}K`;
  if (rows < 1_000_000_000) return `${(rows / 1_000_000).toFixed(1)}M`;
  return `${(rows / 1_000_000_000).toFixed(1)}B`;
}

export default function NewExport() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [feedSearch, setFeedSearch] = useState("");
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<number>>(
    new Set(),
  );
  const [channel, setChannel] = useState(4);
  const [columns, setColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter((c) => c.default).map((c) => c.value)),
  );
  const [splitByFeed, setSplitByFeed] = useState(false);
  const [startDt, setStartDt] = useState("");
  const [endDt, setEndDt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedsLoading, setFeedsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feeds")
      .then((r) => r.json())
      .then((data) => setFeeds(data.feeds ?? []))
      .catch(() => setError("Failed to load feed catalog"))
      .finally(() => setFeedsLoading(false));
  }, []);

  const filteredFeeds = useMemo(() => {
    if (!feedSearch) return feeds.slice(0, 50);
    const q = feedSearch.toLowerCase();
    return feeds
      .filter(
        (f) =>
          f.pyth_lazer_id.toString().includes(q) ||
          f.symbol?.toLowerCase().includes(q) ||
          f.name?.toLowerCase().includes(q) ||
          f.asset_type?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [feeds, feedSearch]);

  // O(1) feed lookup by ID
  const feedMap = useMemo(
    () => new Map(feeds.map((f) => [f.pyth_lazer_id, f])),
    [feeds],
  );

  // Check which selected feeds don't support the chosen channel
  const incompatibleFeeds = useMemo(() => {
    if (selectedFeedIds.size === 0) return [];
    return [...selectedFeedIds]
      .map((id) => feedMap.get(id))
      .filter((f): f is Feed => !!f && !feedSupportsChannel(f, channel));
  }, [feedMap, selectedFeedIds, channel]);

  const estimate = useMemo(() => {
    if (!startDt || !endDt || selectedFeedIds.size === 0) return null;
    const start = new Date(startDt);
    const end = new Date(endDt);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    )
      return null;

    const rangeSec = (end.getTime() - start.getTime()) / 1000;
    const rate = CHANNEL_RATES[channel] ?? 1;
    const rows = rangeSec * rate * selectedFeedIds.size;
    const bytes = rows * ROW_SIZE_ESTIMATE;

    return { bytes, rows };
  }, [startDt, endDt, channel, selectedFeedIds]);

  function toggleFeed(id: number) {
    setSelectedFeedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleColumn(col: string) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/export", {
        body: JSON.stringify({
          channel,
          client_name: clientName,
          columns: [...columns],
          end_dt: endDt.replace("T", " ") + (endDt.includes(":") ? ":00" : ""),
          feed_ids: [...selectedFeedIds],
          split_by_feed: splitByFeed,
          start_dt:
            startDt.replace("T", " ") + (startDt.includes(":") ? ":00" : ""),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to submit export");
        setSubmitting(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputStyle = {
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    boxSizing: "border-box" as const,
    color: "#e0e0e0",
    fontSize: 14,
    padding: "8px 12px",
    width: "100%",
  };

  const labelStyle = {
    color: "#ccc",
    display: "block",
    fontSize: 14,
    fontWeight: 500 as const,
    marginBottom: 6,
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>
        New Data Export Request
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Client Name */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="client-name" style={labelStyle}>
            Client Name / Export Name{" "}
            <span style={{ color: "#f87171" }}>*</span>
          </label>
          <input
            id="client-name"
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. ACME Corp - Jan 2026 Export"
            required
            style={inputStyle}
            type="text"
            value={clientName}
          />
        </div>

        {/* Feed Search + Selection */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="feed-search" style={labelStyle}>
            Search Price Feeds{" "}
            <span style={{ color: "#888", fontWeight: 400 }}>
              ({selectedFeedIds.size} selected)
            </span>
          </label>
          <input
            id="feed-search"
            onChange={(e) => setFeedSearch(e.target.value)}
            placeholder="Search by ID, symbol, name, or asset type"
            style={{ ...inputStyle, marginBottom: 8 }}
            type="text"
            value={feedSearch}
          />

          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 6,
              maxHeight: 250,
              overflow: "auto",
            }}
          >
            {feedsLoading ? (
              <p style={{ color: "#888", padding: 12 }}>Loading feeds...</p>
            ) : (
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: 13,
                  width: "100%",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #333", color: "#888" }}>
                    <th style={{ padding: "6px 8px", width: 32 }}></th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>
                      ID
                    </th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>
                      Symbol
                    </th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>
                      Name
                    </th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeeds.map((f) => (
                    <tr
                      key={f.pyth_lazer_id}
                      onClick={() => toggleFeed(f.pyth_lazer_id)}
                      style={{
                        backgroundColor: selectedFeedIds.has(f.pyth_lazer_id)
                          ? "#1a2a3a"
                          : "transparent",
                        borderBottom: "1px solid #222",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <input
                          checked={selectedFeedIds.has(f.pyth_lazer_id)}
                          onChange={() => toggleFeed(f.pyth_lazer_id)}
                          onClick={(e) => e.stopPropagation()}
                          type="checkbox"
                        />
                      </td>
                      <td style={{ padding: "6px 8px" }}>{f.pyth_lazer_id}</td>
                      <td style={{ padding: "6px 8px" }}>{f.symbol}</td>
                      <td style={{ padding: "6px 8px" }}>{f.name}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          style={{
                            backgroundColor: "#222",
                            borderRadius: 3,
                            fontSize: 12,
                            padding: "1px 6px",
                          }}
                        >
                          {f.asset_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedFeedIds.size > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>
                Selected ({selectedFeedIds.size}):
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...selectedFeedIds]
                  .sort((a, b) => a - b)
                  .map((id) => {
                    const feed = feedMap.get(id);
                    return (
                      <span
                        key={id}
                        style={{
                          alignItems: "center",
                          backgroundColor: "#1a2a3a",
                          border: "1px solid #334155",
                          borderRadius: 4,
                          color: "#93c5fd",
                          display: "inline-flex",
                          fontSize: 13,
                          gap: 6,
                          padding: "4px 8px",
                        }}
                      >
                        <strong>{id}</strong>
                        {feed ? ` ${feed.symbol}` : ""}
                        <button
                          onClick={() => toggleFeed(id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            padding: 0,
                          }}
                          title="Remove"
                          type="button"
                        >
                          x
                        </button>
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {incompatibleFeeds.length > 0 && (
            <div
              style={{
                backgroundColor: "#3a2a1a",
                border: "1px solid #f59e0b",
                borderRadius: 6,
                color: "#fbbf24",
                fontSize: 13,
                marginTop: 8,
                padding: 10,
              }}
            >
              <strong>Channel not supported:</strong>{" "}
              {incompatibleFeeds.map((f) => (
                <span key={f.pyth_lazer_id}>
                  {f.name ?? f.symbol} (ID {f.pyth_lazer_id}, min:{" "}
                  {f.min_channel}){", "}
                </span>
              ))}
              <br />
              Switch to a slower channel or remove these feeds.
            </div>
          )}
        </div>

        {/* Channel */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="channel" style={labelStyle}>
            Channel <span style={{ color: "#f87171" }}>*</span>
          </label>
          <select
            id="channel"
            onChange={(e) => setChannel(Number(e.target.value))}
            style={inputStyle}
            value={channel}
          >
            {CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>
                {ch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Columns */}
        <fieldset style={{ border: "none", marginBottom: 20, padding: 0 }}>
          <legend style={labelStyle}>
            Columns to Export <span style={{ color: "#f87171" }}>*</span>
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Price", "Metadata", "Funding"].map((group) => (
              <div key={group}>
                <p style={{ color: "#888", fontSize: 12, margin: "0 0 4px 0" }}>
                  {group}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {ALL_COLUMNS.filter((c) => c.group === group).map((col) => (
                    <label
                      key={col.value}
                      style={{
                        alignItems: "center",
                        cursor: "pointer",
                        display: "flex",
                        fontSize: 14,
                        gap: 4,
                      }}
                    >
                      <input
                        checked={columns.has(col.value)}
                        onChange={() => toggleColumn(col.value)}
                        type="checkbox"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Split by Feed */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              alignItems: "center",
              cursor: "pointer",
              display: "flex",
              fontSize: 14,
              gap: 8,
            }}
          >
            <input
              checked={splitByFeed}
              onChange={(e) => setSplitByFeed(e.target.checked)}
              type="checkbox"
            />
            Split by feed
            <span style={{ color: "#888", fontWeight: 400 }}>
              — one S3 subfolder per feed ID
            </span>
          </label>
        </div>

        {/* Date Range (UTC) */}
        <p style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
          All times are in UTC
        </p>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="start-date" style={labelStyle}>
              Start Date (UTC) <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              id="start-date"
              onChange={(e) =>
                setStartDt(
                  `${e.target.value}T${startDt.split("T")[1] ?? "00:00"}`,
                )
              }
              required
              style={{ ...inputStyle, colorScheme: "dark" }}
              type="date"
              value={startDt.split("T")[0] ?? ""}
            />
            <label htmlFor="start-time" style={{ ...labelStyle, marginTop: 8 }}>
              Start Time (UTC)
            </label>
            <input
              id="start-time"
              onChange={(e) =>
                setStartDt(`${startDt.split("T")[0] ?? ""}T${e.target.value}`)
              }
              style={{ ...inputStyle, colorScheme: "dark" }}
              type="time"
              value={startDt.split("T")[1] ?? "00:00"}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="end-date" style={labelStyle}>
              End Date (UTC) <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              id="end-date"
              onChange={(e) =>
                setEndDt(`${e.target.value}T${endDt.split("T")[1] ?? "23:59"}`)
              }
              required
              style={{ ...inputStyle, colorScheme: "dark" }}
              type="date"
              value={endDt.split("T")[0] ?? ""}
            />
            <label htmlFor="end-time" style={{ ...labelStyle, marginTop: 8 }}>
              End Time (UTC)
            </label>
            <input
              id="end-time"
              onChange={(e) =>
                setEndDt(`${endDt.split("T")[0] ?? ""}T${e.target.value}`)
              }
              style={{ ...inputStyle, colorScheme: "dark" }}
              type="time"
              value={endDt.split("T")[1] ?? "23:59"}
            />
          </div>
        </div>

        {/* Estimate */}
        {estimate && (
          <div
            style={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#aaa",
              fontSize: 13,
              marginBottom: 20,
              padding: 12,
            }}
          >
            Estimated: ~{formatRows(estimate.rows)} rows, ~
            {formatBytes(estimate.bytes)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              backgroundColor: "#3a1a1a",
              border: "1px solid #f87171",
              borderRadius: 6,
              color: "#f87171",
              fontSize: 14,
              marginBottom: 20,
              padding: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              backgroundColor: "#222",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#aaa",
              cursor: "pointer",
              fontSize: 14,
              padding: "10px 20px",
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            disabled={
              submitting ||
              selectedFeedIds.size === 0 ||
              columns.size === 0 ||
              incompatibleFeeds.length > 0
            }
            style={{
              backgroundColor:
                submitting || incompatibleFeeds.length > 0 ? "#444" : "#6366f1",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor:
                submitting || incompatibleFeeds.length > 0
                  ? "not-allowed"
                  : "pointer",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 20px",
            }}
            type="submit"
          >
            {submitting ? "Submitting..." : "Submit Export"}
          </button>
        </div>
      </form>
    </div>
  );
}
