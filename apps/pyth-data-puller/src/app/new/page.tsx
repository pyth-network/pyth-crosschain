"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Feed = {
  pyth_lazer_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  min_channel?: number;
};

const CHANNELS = [
  { label: "Channel 1 — Real-time (~1ms)", value: 1 },
  { label: "Channel 2 — fixed_rate@50ms", value: 2 },
  { label: "Channel 3 — fixed_rate@200ms", value: 3 },
  { label: "Channel 4 — fixed_rate@1000ms (1s)", value: 4 },
];

const ALL_COLUMNS = [
  { default: true, label: "Price", value: "price" },
  { default: true, label: "Best Bid", value: "best_bid_price" },
  { default: true, label: "Best Ask", value: "best_ask_price" },
  { default: false, label: "Publisher Count", value: "publisher_count" },
  { default: false, label: "Confidence", value: "confidence" },
  { default: false, label: "Market Session", value: "market_session" },
];

const CHANNEL_RATES: Record<number, number> = { 1: 1000, 2: 20, 3: 5, 4: 1 };

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
    const bytes = rows * 55;

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
            <p style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              Selected IDs:{" "}
              {[...selectedFeedIds].sort((a, b) => a - b).join(", ")}
            </p>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {ALL_COLUMNS.map((col) => (
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
        </fieldset>

        {/* Date Range */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="start-dt" style={labelStyle}>
              Start Date & Time <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              id="start-dt"
              onChange={(e) => setStartDt(e.target.value)}
              required
              style={inputStyle}
              type="datetime-local"
              value={startDt}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="end-dt" style={labelStyle}>
              End Date & Time <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              id="end-dt"
              onChange={(e) => setEndDt(e.target.value)}
              required
              style={inputStyle}
              type="datetime-local"
              value={endDt}
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
              submitting || selectedFeedIds.size === 0 || columns.size === 0
            }
            style={{
              backgroundColor: submitting ? "#444" : "#6366f1",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: submitting ? "not-allowed" : "pointer",
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
