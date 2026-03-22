import { resolve } from "node:path";
import Database from "better-sqlite3";
import type { ExportStatus } from "./validate";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbDir = resolve(process.cwd(), "data");
    const { mkdirSync, existsSync } = require("node:fs");
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    _db = new Database(resolve(dbDir, "exports.db"));
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS exports (
        id              TEXT PRIMARY KEY,
        client_name     TEXT NOT NULL,
        feed_ids        TEXT NOT NULL,
        channel         INTEGER NOT NULL,
        columns         TEXT NOT NULL,
        start_dt        TEXT NOT NULL,
        end_dt          TEXT NOT NULL,
        batch_mode      TEXT,
        batch_days      INTEGER,
        batch_minutes   INTEGER,
        feed_group_size INTEGER DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'queued',
        s3_url          TEXT,
        s3_manifest     TEXT,
        error_msg       TEXT,
        pid             INTEGER,
        file_count      INTEGER,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);
      CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);
    `);

    // Startup sweep: mark any exports stuck in "processing" as failed
    _db
      .prepare(
        `UPDATE exports
       SET status = 'failed',
           error_msg = 'Server restarted during export. Please retry.',
           updated_at = datetime('now')
       WHERE status IN ('processing', 'queued')`
      )
      .run();
  }
  return _db;
}

export type ExportRow = {
  id: string;
  client_name: string;
  feed_ids: string;
  channel: number;
  columns: string;
  start_dt: string;
  end_dt: string;
  batch_mode: string | null;
  batch_days: number | null;
  batch_minutes: number | null;
  feed_group_size: number;
  status: ExportStatus;
  s3_url: string | null;
  s3_manifest: string | null;
  error_msg: string | null;
  pid: number | null;
  file_count: number | null;
  created_at: string;
  updated_at: string;
};

export function insertExport(row: Omit<ExportRow, "updated_at">): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO exports (
      id, client_name, feed_ids, channel, columns,
      start_dt, end_dt, batch_mode, batch_days, batch_minutes,
      feed_group_size, status, s3_url, s3_manifest, error_msg,
      pid, file_count, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, datetime('now')
    )`,
  ).run(
    row.id,
    row.client_name,
    row.feed_ids,
    row.channel,
    row.columns,
    row.start_dt,
    row.end_dt,
    row.batch_mode,
    row.batch_days,
    row.batch_minutes,
    row.feed_group_size,
    row.status,
    row.s3_url,
    row.s3_manifest,
    row.error_msg,
    row.pid,
    row.file_count,
    row.created_at,
  );
}

/**
 * Atomically check the concurrent export limit and insert a new export.
 * Returns the export ID if inserted, or null if the limit was reached.
 * Uses a better-sqlite3 transaction (exclusive lock) to prevent TOCTOU races.
 */
export function insertExportIfUnderLimit(
  row: Omit<ExportRow, "updated_at">,
  maxConcurrent: number,
): string | null {
  const db = getDb();
  const txn = db.transaction(() => {
    const { c } = db
      .prepare(
        "SELECT count(*) as c FROM exports WHERE status IN ('queued', 'processing')",
      )
      .get() as { c: number };
    if (c >= maxConcurrent) return null;
    insertExport(row);
    return row.id;
  });
  return txn();
}

const UPDATABLE_COLUMNS = new Set([
  "status",
  "s3_url",
  "s3_manifest",
  "error_msg",
  "pid",
  "file_count",
]);

export function updateExport(
  id: string,
  fields: Record<string, string | number | null>,
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!UPDATABLE_COLUMNS.has(key)) {
      throw new Error(`updateExport: invalid column "${key}"`);
    }
    // SAFETY: column names are validated against UPDATABLE_COLUMNS allowlist above
    sets.push(`${key} = ?`);
    values.push(value ?? null);
  }

  values.push(id);
  db.prepare(`UPDATE exports SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
}

export function getExport(id: string): ExportRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM exports WHERE id = ?").get(id) as
    | ExportRow
    | undefined;
}

export function listExports(
  limit: number,
  offset: number,
): { exports: ExportRow[]; total: number } {
  const db = getDb();
  const exports = db
    .prepare("SELECT * FROM exports ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset) as ExportRow[];
  const row = db.prepare("SELECT count(*) as total FROM exports").get() as {
    total: number;
  };
  return { exports, total: row.total };
}
