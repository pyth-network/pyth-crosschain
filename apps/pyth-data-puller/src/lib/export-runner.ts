import { execSync, spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { SplitConfig } from "./auto-split";
import { CHANNEL_DISPLAY } from "./channels";
import { updateExport } from "./db";
import { VALID_COLUMNS } from "./validate";

const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const SIGKILL_DELAY_MS = 30_000; // 30 seconds after SIGTERM

type ExportConfig = {
  id: string;
  clientName: string;
  feedIds: number[];
  feedSymbols: Record<number, string>;
  channel: number;
  columns: string[];
  startDt: string;
  endDt: string;
  split: SplitConfig;
};

function getScriptPath(): string {
  return resolve(process.cwd(), "scripts", "run_lazer_export_s3.sh");
}

function getLogsDir(): string {
  return resolve(process.cwd(), "logs");
}

function getLogPath(id: string): string {
  return resolve(getLogsDir(), `${id}.log`);
}

function getTmpEnvPath(id: string): string {
  return resolve("/tmp", `export_${id}.env`);
}

/** Strip characters that are dangerous in bash double-quoted strings */
function sanitizeForEnv(value: string): string {
  return value.replace(/["`$\\()!\n\r]/g, "");
}

function buildEnvConfig(config: ExportConfig): string {
  const feedLabels = config.feedIds
    .map(
      (feedId) =>
        `${feedId} (${sanitizeForEnv(config.feedSymbols[feedId] ?? "unknown")})`,
    )
    .join(", ");

  const lines: string[] = [
    `PRICE_FEED_IDS="${config.feedIds.join(",")}"`,
    `START_DATETIME="${config.startDt}"`,
    `END_DATETIME="${config.endDt}"`,
    `CHANNEL=${config.channel}`,
    `DATABASE="default"`,
    `BATCH_MODE="${config.split.batchMode}"`,
    `BATCH_DAYS=${config.split.batchDays}`,
    `BATCH_MINUTES=${config.split.batchMinutes}`,
    `BATCH_OUTPUT_MODE="split"`,
    `FEED_GROUP_SIZE=${config.split.feedGroupSize}`,
    `OUTPUT_DEFAULT="export.csv"`,
    `GENERATE_INDEX_HTML=1`,
    `S3_OVERWRITE_ON_INSERT=0`,
    // Metadata for index.html (sanitized for bash safety)
    `EXPORT_NAME="${sanitizeForEnv(config.clientName)}"`,
    `EXPORT_CHANNEL_LABEL="${sanitizeForEnv(CHANNEL_DISPLAY[config.channel] ?? String(config.channel))}"`,
    `EXPORT_FEED_LABELS="${sanitizeForEnv(feedLabels)}"`,
  ];

  // Columns config — compare against VALID_COLUMNS.length, not a magic number
  if (config.columns.length === VALID_COLUMNS.length) {
    lines.push(`EXPORT_COLUMNS="all"`);
  } else {
    lines.push(`EXPORT_COLUMNS="${config.columns.join(",")}"`);
  }

  // Channel-to-interval mapping
  const channelIntervals: Record<number, [number, string]> = {
    1: [1, "millisecond"],
    2: [50, "millisecond"],
    3: [200, "millisecond"],
    4: [1000, "millisecond"],
  };
  const interval = channelIntervals[config.channel] ?? [1000, "millisecond"];
  lines.push(`INTERVAL_VALUE=${interval[0]}`);
  lines.push(`INTERVAL_UNIT=${interval[1]}`);

  // biome-ignore lint/style/noProcessEnv: Server-side env vars for S3 config
  const env = process.env;
  lines.push(`S3_BUCKET="${env.S3_BUCKET ?? "pyth-ch-share-public"}"`);
  lines.push(`S3_REGION="${env.S3_REGION ?? "ap-northeast-1"}"`);
  lines.push(`S3_PREFIX="${env.S3_PREFIX ?? "exports/pyth-dump"}"`);
  lines.push(`S3_ROLE_ARN="${env.S3_ROLE_ARN ?? ""}"`);

  return lines.join("\n") + "\n";
}

/** Redact potential credentials from error output */
function sanitizeErrorMsg(msg: string): string {
  return msg
    .replace(/password[=:]\S+/gi, "password=***")
    .replace(/arn:aws:iam::\d+:\S+/g, "arn:aws:iam::***:***")
    .replace(/https?:\/\/\S+:\S+@/g, "https://***@");
}

function finalizeExport(
  id: string,
  status: "completed" | "failed",
  opts?: {
    errorMsg?: string;
    fileCount?: number;
    s3Url?: string;
    s3Manifest?: string;
  },
): void {
  const fields: Record<string, string | number | null> = { status };

  if (opts?.errorMsg !== undefined)
    fields.error_msg = sanitizeErrorMsg(opts.errorMsg);
  if (opts?.fileCount !== undefined) fields.file_count = opts.fileCount;
  if (opts?.s3Url !== undefined) fields.s3_url = opts.s3Url;
  if (opts?.s3Manifest !== undefined) fields.s3_manifest = opts.s3Manifest;

  updateExport(id, fields);

  // Clean up temp .env file
  try {
    unlinkSync(getTmpEnvPath(id));
  } catch {
    // Already cleaned up or never written
  }
}

function parseExportOutput(logPath: string): {
  fileCount: number | null;
  s3Prefix: string | null;
  s3Index: string | null;
} {
  try {
    const tail = execSync(`tail -50 "${logPath}"`, { encoding: "utf-8" });

    const fileCountMatch = tail.match(/Exported (\d+) batch file/);
    const fileCount = fileCountMatch?.[1]
      ? Number.parseInt(fileCountMatch[1], 10)
      : null;

    const prefixMatch = tail.match(/Prefix: (.+)/);
    const s3Prefix = prefixMatch?.[1]?.trim() ?? null;

    const indexMatch = tail.match(/Index: (.+)/);
    const s3Index = indexMatch?.[1]?.trim() ?? null;

    return { fileCount, s3Index, s3Prefix };
  } catch {
    return { fileCount: null, s3Index: null, s3Prefix: null };
  }
}

export function spawnExport(config: ExportConfig): { pid: number | null } {
  const { id } = config;

  const logsDir = getLogsDir();
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Write temp .env config with restrictive permissions
  const tmpEnvPath = getTmpEnvPath(id);
  writeFileSync(tmpEnvPath, buildEnvConfig(config), {
    encoding: "utf-8",
    mode: 0o600,
  });

  const logPath = getLogPath(id);
  const logStream = createWriteStream(logPath);

  // biome-ignore lint/style/noProcessEnv: Constructing minimal env for child process
  const parentEnv = process.env;

  const scriptPath = getScriptPath();
  const child = spawn(
    "bash",
    [
      scriptPath,
      "--export-id",
      id,
      "--output",
      "export.csv",
      "--config",
      tmpEnvPath,
    ],
    {
      detached: false,
      env: {
        HOME: parentEnv.HOME ?? "",
        HOST: parentEnv.HOST ?? "",
        NODE_ENV: parentEnv.NODE_ENV ?? "production",
        PASSWORD: parentEnv.PASSWORD ?? "",
        PATH: parentEnv.PATH ?? "",
        USER: parentEnv.USER ?? "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const pid = child.pid ?? null;
  let finalized = false;

  if (child.stdout) child.stdout.pipe(logStream);
  if (child.stderr) child.stderr.pipe(logStream);

  updateExport(id, { pid, status: "processing" });

  // Guard to ensure finalizeExport is called only once
  function doFinalize(
    st: "completed" | "failed",
    opts?: Parameters<typeof finalizeExport>[2],
  ) {
    if (finalized) return;
    finalized = true;
    finalizeExport(id, st, opts);
  }

  let sigkillTimer: ReturnType<typeof setTimeout> | null = null;

  const timeoutTimer = setTimeout(() => {
    child.kill("SIGTERM");

    sigkillTimer = setTimeout(() => {
      if (pid !== null) {
        try {
          process.kill(pid, 0);
          child.kill("SIGKILL");
        } catch {
          // Already dead
        }
      }
    }, SIGKILL_DELAY_MS);

    doFinalize("failed", {
      errorMsg: "Export timed out after 24 hours",
    });
  }, TIMEOUT_MS);

  // Prevent the 24h timer from keeping Node alive on shutdown
  timeoutTimer.unref();

  child.on("error", (err) => {
    clearTimeout(timeoutTimer);
    if (sigkillTimer) clearTimeout(sigkillTimer);
    logStream.end();
    doFinalize("failed", { errorMsg: err.message });
  });

  child.on("exit", (code) => {
    clearTimeout(timeoutTimer);
    if (sigkillTimer) clearTimeout(sigkillTimer);
    logStream.end();

    if (code === 0) {
      const { fileCount, s3Prefix, s3Index } = parseExportOutput(logPath);
      const hasData = fileCount !== null && fileCount > 0;

      doFinalize("completed", {
        ...(hasData
          ? {}
          : { errorMsg: "Warning: no data found for the given parameters" }),
        fileCount: fileCount ?? 0,
        ...(s3Prefix ? { s3Url: s3Prefix } : {}),
        ...(s3Index ? { s3Manifest: s3Index } : {}),
      });
    } else {
      let errorMsg = `Script exited with code ${code}`;
      try {
        const tail = execSync(`tail -c 500 "${logPath}"`, {
          encoding: "utf-8",
        });
        errorMsg = tail.trim() || errorMsg;
      } catch {
        // Use default error message
      }

      doFinalize("failed", { errorMsg });
    }
  });

  return { pid };
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export { getLogPath };
