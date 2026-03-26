"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CHANNEL_LABELS } from "../lib/channels";
import type { ExportStatus, Feed } from "../lib/validate";

type Export = {
  id: string;
  client_name: string;
  feed_ids: string;
  channel: number;
  start_dt: string;
  end_dt: string;
  status: ExportStatus;
  s3_url: string | null;
  s3_manifest: string | null;
  error_msg: string | null;
  file_count: number | null;
  created_at: string;
  updated_at: string;
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

function formatFeeds(feedIdsJson: string, feedMap: Map<number, Feed>): string {
  try {
    const ids = JSON.parse(feedIdsJson) as number[];
    const labels = ids.map((id) => {
      const feed = feedMap.get(id);
      return feed ? `${id} (${feed.symbol})` : String(id);
    });
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
  } catch {
    return feedIdsJson;
  }
}

function formatDateRange(start: string, end: string): string {
  return `${start} → ${end}`;
}

function formatRange(start: string, end: string): string {
  const s = new Date(`${start.replace(" ", "T")}Z`);
  const e = new Date(`${end.replace(" ", "T")}Z`);
  let diffSec = Math.floor((e.getTime() - s.getTime()) / 1000);
  if (diffSec <= 0) return "—";

  const weeks = Math.floor(diffSec / 604_800);
  diffSec %= 604_800;
  const days = Math.floor(diffSec / 86_400);
  diffSec %= 86_400;
  const hours = Math.floor(diffSec / 3600);
  diffSec %= 3600;
  const mins = Math.floor(diffSec / 60);

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && weeks === 0) parts.push(`${mins}m`);

  return parts.join(" ") || "<1m";
}

export default function Dashboard() {
  const [exports, setExports] = useState<Export[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedMap, setFeedMap] = useState<Map<number, Feed>>(new Map());
  const limit = 20;

  // Fetch feed catalog once for symbol name lookup
  useEffect(() => {
    fetch("/api/feeds")
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<number, Feed>();
        for (const f of data.feeds ?? []) {
          map.set(f.pyth_lazer_id, f);
        }
        setFeedMap(map);
      })
      .catch(() => {
        // Feed names won't be available — IDs will still show
      });
  }, []);

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
                <th style={{ padding: "8px 12px" }}>Date Range (UTC)</th>
                <th style={{ padding: "8px 12px" }}>Range</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "10px 12px" }}>{exp.client_name}</td>
                  <td
                    style={{
                      color: "#aaa",
                      fontSize: 13,
                      maxWidth: 250,
                      padding: "10px 12px",
                    }}
                  >
                    {formatFeeds(exp.feed_ids, feedMap)}
                  </td>
                  <td style={{ color: "#aaa", padding: "10px 12px" }}>
                    {CHANNEL_LABELS[exp.channel] ?? exp.channel}
                  </td>
                  <td
                    style={{
                      color: "#aaa",
                      fontSize: 12,
                      padding: "10px 12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDateRange(exp.start_dt, exp.end_dt)}
                  </td>
                  <td
                    style={{
                      color: "#aaa",
                      fontSize: 13,
                      padding: "10px 12px",
                    }}
                  >
                    {formatRange(exp.start_dt, exp.end_dt)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge status={exp.status} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(exp.s3_url ?? exp.s3_manifest) && (
                        <a
                          href={exp.s3_url ?? exp.s3_manifest ?? ""}
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
