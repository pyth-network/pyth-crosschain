import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { NextResponse } from "next/server";
import { getLogPath } from "../../../../lib/export-runner";

const MAX_LOG_BYTES = 1024 * 1024; // 1MB

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Sanitize id to prevent path traversal
  if (!/^[\da-f-]+$/i.test(id)) {
    return NextResponse.json({ error: "Invalid export ID" }, { status: 400 });
  }

  const logPath = getLogPath(id);

  if (!existsSync(logPath)) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const stat = statSync(logPath);
  let content: string;

  if (stat.size > MAX_LOG_BYTES) {
    content = execSync(`tail -c ${MAX_LOG_BYTES} "${logPath}"`, {
      encoding: "utf-8",
    });
    content = `[...truncated, showing last 1MB...]\n${content}`;
  } else {
    content = readFileSync(logPath, "utf-8");
  }

  return NextResponse.json({ id, log: content });
}
