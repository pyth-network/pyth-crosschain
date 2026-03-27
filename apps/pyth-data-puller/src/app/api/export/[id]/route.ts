import { NextResponse } from "next/server";
import { getExport, updateExport } from "../../../../lib/db";
import { isProcessAlive } from "../../../../lib/export-runner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[\da-f-]+$/i.test(id)) {
    return NextResponse.json({ error: "Invalid export ID" }, { status: 400 });
  }

  const exp = getExport(id);

  if (!exp) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  // For in-progress exports, verify the process is still alive
  if (exp.status === "processing" && exp.pid) {
    const alive = isProcessAlive(exp.pid);

    if (!alive) {
      // Process died without updating status — mark as failed
      updateExport(id, {
        error_msg: "Process died unexpectedly. Check logs for details.",
        status: "failed",
      });
      const updated = getExport(id);
      return NextResponse.json(updated);
    }
  }

  return NextResponse.json(exp);
}
