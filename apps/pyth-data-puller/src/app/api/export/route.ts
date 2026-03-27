import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  autoSplit,
  estimateFiles,
  estimateSize,
} from "../../../lib/auto-split";
import { insertExportIfUnderLimit, updateExport } from "../../../lib/db";
import { spawnExport } from "../../../lib/export-runner";
import { buildFeedMap, fetchFeeds } from "../../../lib/feeds";
import {
  estimateRowCount,
  exportRequestSchema,
  validateDateRange,
  validateMinChannel,
} from "../../../lib/validate";

const MAX_CONCURRENT = 3;

export async function POST(request: Request) {
  // Parse JSON body — return 400 for malformed input, not 500
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  let exportId: string | null = null;

  try {
    const parsed = exportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const {
      client_name,
      feed_ids,
      channel,
      columns,
      split_by_feed,
      start_dt,
      end_dt,
    } = parsed.data;

    const dateError = validateDateRange(start_dt, end_dt);
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 });
    }

    // Fetch feed catalog + build Map for O(1) lookups
    let feedMap: ReturnType<typeof buildFeedMap>;
    try {
      const feeds = await fetchFeeds();
      feedMap = buildFeedMap(feeds);
    } catch {
      return NextResponse.json(
        { error: "Feed catalog temporarily unavailable. Try again." },
        { status: 503 },
      );
    }

    const channelError = validateMinChannel(feed_ids, channel, feedMap);
    if (channelError) {
      return NextResponse.json({ error: channelError }, { status: 400 });
    }

    const {
      rows,
      rangeSec,
      error: rowError,
    } = estimateRowCount(channel, feed_ids.length, start_dt, end_dt);
    if (rowError) {
      return NextResponse.json({ error: rowError }, { status: 400 });
    }

    const split = autoSplit(channel, feed_ids.length, rangeSec, split_by_feed);
    const estFiles = estimateFiles(split, feed_ids.length, rangeSec);
    const estSize = estimateSize(channel, feed_ids.length, rangeSec);

    const id = randomUUID();
    exportId = id;
    const now = new Date().toISOString();

    // Atomic: check concurrent limit + insert in a single transaction
    const inserted = insertExportIfUnderLimit(
      {
        batch_days: split.batchDays,
        batch_minutes: split.batchMinutes,
        batch_mode: split.batchMode,
        channel,
        client_name,
        columns: JSON.stringify(columns),
        created_at: now,
        end_dt,
        error_msg: null,
        feed_group_size: split.feedGroupSize,
        feed_ids: JSON.stringify(feed_ids),
        file_count: null,
        id,
        pid: null,
        s3_manifest: null,
        s3_url: null,
        start_dt,
        status: "queued",
      },
      MAX_CONCURRENT,
    );

    if (!inserted) {
      return NextResponse.json(
        { error: `Max ${MAX_CONCURRENT} concurrent exports. Try again later.` },
        { status: 429 },
      );
    }

    // Build feed symbol lookup using the Map (O(n), not O(n*m))
    const feedSymbols: Record<number, string> = {};
    for (const feedId of feed_ids) {
      const feed = feedMap.get(feedId);
      if (feed) feedSymbols[feedId] = feed.symbol;
    }

    const { pid } = spawnExport({
      channel,
      clientName: client_name,
      columns,
      endDt: end_dt,
      feedIds: feed_ids,
      feedSymbols,
      id,
      split,
      startDt: start_dt,
    });

    return NextResponse.json(
      {
        estimated_files: estFiles,
        estimated_rows: rows,
        estimated_size_bytes: estSize,
        id,
        pid,
        split_config: split,
        status: "processing",
      },
      { status: 202 },
    );
  } catch {
    // If spawnExport failed after DB insert, mark the export as failed
    // so it doesn't permanently consume a concurrency slot
    if (exportId) {
      try {
        updateExport(exportId, {
          error_msg: "Failed to start export process",
          status: "failed",
        });
      } catch {
        // Best-effort cleanup
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
