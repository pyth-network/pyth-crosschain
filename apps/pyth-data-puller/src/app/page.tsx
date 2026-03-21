"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Export = {
  id: string;
  client_name: string;
  feed_ids: string;
  channel: number;
  start_dt: string;
  end_dt: string;
  status: string;
  s3_manifest: string | null;
  error_msg: string | null;
  file_count: number | null;
  created_at: string;
  updated_at: string;
};

const CHANNEL_LABELS: Record<number, string> = {
  1: "RT (1ms)",
  2: "50ms",
  3: "200ms",
  4: "1s",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: "#1a2a3a", label: "Completed", text: "#60a5fa" },
    failed: { bg: "#3a1a1a", label: "Failed", text: "#f87171" },
    processing: { bg: "#1a3a2a", label: "Processing", text: "#4ade80" },
    queued: { bg: "#333", label: "Queued", text: "#aaa" },
  };
  const fallback = { bg: "#333", label: "Queued", text: "#aaa" };
  const s = styles[status] ?? fallback;

  return (
    <span
      style={{
        backgroundColor: s.bg,
        borderRadius: 4,
        color: s.text,
        fontSize: 13,
        fontWeight: 500,
        padding: "2px 8px",
      }}
    >
      {s.label}
    </span>
  );
}

function formatDuration(created: string, updated: string): string {
  const ms = new Date(updated).getTime() - new Date(created).getTime();
  if (ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  if (hrs > 0) return `${hrs}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function formatFeeds(feedIdsJson: string): string {
  try {
    const ids = JSON.parse(feedIdsJson) as number[];
    if (ids.length <= 3) return ids.join(", ");
    return `${ids.slice(0, 2).join(", ")} +${ids.length - 2} more`;
  } catch {
    return feedIdsJson;
  }
}

function formatDateRange(start: string, end: string): string {
  const s = start.split(" ")[0] ?? start;
  const e = end.split(" ")[0] ?? end;
  if (s === e) return s;
  return `${s} — ${e}`;
}

export default function Dashboard() {
  const [exports, setExports] = useState<Export[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchExports = useCallback(async () => {
    try {
      const res = await fetch(`/api/exports?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      setExports(data.exports);
      setTotal(data.total);
    } catch (_err) {
      // Silently fail — dashboard will show stale data
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchExports();
    // Poll every 5 seconds for in-progress exports
    const interval = setInterval(fetchExports, 5000);
    return () => clearInterval(interval);
  }, [fetchExports]);

  const hasProcessing = exports.some((e) => e.status === "processing");

  return (
    <div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Pyth Data Exports</h1>
        <Link
          href="/new"
          style={{
            backgroundColor: "#6366f1",
            borderRadius: 6,
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            padding: "8px 16px",
            textDecoration: "none",
          }}
        >
          New Export
        </Link>
      </div>

      {loading && <p style={{ color: "#888" }}>Loading...</p>}

      {!loading && exports.length === 0 && (
        <div
          style={{
            color: "#666",
            padding: 48,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 18 }}>No exports yet</p>
          <p>
            <Link href="/new" style={{ color: "#6366f1" }}>
              Create your first export
            </Link>
          </p>
        </div>
      )}

      {!loading && exports.length > 0 && (
        <>
          {hasProcessing && (
            <p style={{ color: "#4ade80", fontSize: 13, marginBottom: 12 }}>
              Auto-refreshing every 5s...
            </p>
          )}

          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 14,
              width: "100%",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #333",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 12px" }}>Name</th>
                <th style={{ padding: "8px 12px" }}>Feeds</th>
                <th style={{ padding: "8px 12px" }}>Channel</th>
                <th style={{ padding: "8px 12px" }}>Date Range</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px" }}>Duration</th>
                <th style={{ padding: "8px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "10px 12px" }}>{exp.client_name}</td>
                  <td style={{ color: "#aaa", padding: "10px 12px" }}>
                    {formatFeeds(exp.feed_ids)}
                  </td>
                  <td style={{ color: "#aaa", padding: "10px 12px" }}>
                    {CHANNEL_LABELS[exp.channel] ?? exp.channel}
                  </td>
                  <td
                    style={{
                      color: "#aaa",
                      fontSize: 13,
                      padding: "10px 12px",
                    }}
                  >
                    {formatDateRange(exp.start_dt, exp.end_dt)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge status={exp.status} />
                  </td>
                  <td style={{ color: "#aaa", padding: "10px 12px" }}>
                    {formatDuration(exp.created_at, exp.updated_at)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {exp.s3_manifest && (
                        <a
                          href={exp.s3_manifest}
                          rel="noopener noreferrer"
                          style={{ color: "#60a5fa", fontSize: 13 }}
                          target="_blank"
                        >
                          S3
                        </a>
                      )}
                      <a
                        href={`/api/logs/${exp.id}`}
                        rel="noopener noreferrer"
                        style={{ color: "#888", fontSize: 13 }}
                        target="_blank"
                      >
                        Logs
                      </a>
                    </div>
                    {exp.error_msg && exp.status === "failed" && (
                      <div
                        style={{
                          color: "#f87171",
                          fontSize: 12,
                          marginTop: 4,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={exp.error_msg}
                      >
                        {exp.error_msg}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > limit && (
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                style={{
                  backgroundColor: offset === 0 ? "#222" : "#333",
                  border: "none",
                  borderRadius: 4,
                  color: offset === 0 ? "#555" : "#ccc",
                  cursor: offset === 0 ? "default" : "pointer",
                  padding: "6px 12px",
                }}
              >
                Previous
              </button>
              <span style={{ color: "#888", fontSize: 13, lineHeight: "32px" }}>
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                style={{
                  backgroundColor: offset + limit >= total ? "#222" : "#333",
                  border: "none",
                  borderRadius: 4,
                  color: offset + limit >= total ? "#555" : "#ccc",
                  cursor: offset + limit >= total ? "default" : "pointer",
                  padding: "6px 12px",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
