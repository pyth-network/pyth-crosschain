import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  autoSplit,
  estimateFiles,
  estimateSize,
} from "../../../lib/auto-split";
import { countProcessing, insertExport } from "../../../lib/db";
import { spawnExport } from "../../../lib/export-runner";
import { fetchFeeds } from "../../../lib/feeds";
import type { Feed } from "../../../lib/validate";
import {
  estimateRowCount,
  exportRequestSchema,
  getRangeSeconds,
  validateDateRange,
  validateMinChannel,
} from "../../../lib/validate";

const MAX_CONCURRENT = 3;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate schema
    const parsed = exportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { client_name, feed_ids, channel, columns, start_dt, end_dt } =
      parsed.data;

    // Validate date range
    const dateError = validateDateRange(start_dt, end_dt);
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 });
    }

    // Validate min_channel
    let feeds: Feed[];
    try {
      feeds = await fetchFeeds();
    } catch {
      return NextResponse.json(
        { error: "Feed catalog temporarily unavailable. Try again." },
        { status: 503 },
      );
    }

    const channelError = validateMinChannel(feed_ids, channel, feeds);
    if (channelError) {
      return NextResponse.json({ error: channelError }, { status: 400 });
    }

    // Check row estimate
    const { rows, error: rowError } = estimateRowCount(
      channel,
      feed_ids.length,
      start_dt,
      end_dt,
    );
    if (rowError) {
      return NextResponse.json({ error: rowError }, { status: 400 });
    }

    // Check concurrent limit
    const processing = countProcessing();
    if (processing >= MAX_CONCURRENT) {
      return NextResponse.json(
        { error: `Max ${MAX_CONCURRENT} concurrent exports. Try again later.` },
        { status: 429 },
      );
    }

    // Auto-split
    const rangeSec = getRangeSeconds(start_dt, end_dt);
    const split = autoSplit(channel, feed_ids.length, rangeSec);
    const estFiles = estimateFiles(split, feed_ids.length, rangeSec);
    const estSize = estimateSize(channel, feed_ids.length, rangeSec);

    // Create export record
    const id = randomUUID();
    const now = new Date().toISOString();

    insertExport({
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
    });

    // Spawn export process
    const { pid } = spawnExport({
      channel,
      columns,
      endDt: end_dt,
      feedIds: feed_ids,
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
  } catch (_err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
