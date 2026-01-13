import { NextResponse } from "next/server";

import { getLLMText } from "../../lib/get-llm-text";
import { source } from "../../lib/source";

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();
  const scan = pages.map((page) => getLLMText(page));
  const scanned = await Promise.all(scan);

  const content = [
    "# Pyth Network - Complete Documentation",
    "",
    "> First-party financial oracle delivering real-time market data to blockchain applications.",
    "",
    `Generated on: ${new Date().toISOString()}`,
    "",
    "This file contains the complete Pyth documentation for LLM consumption.",
    "For a concise overview, see: https://docs.pyth.network/llms.txt",
    "",
    "---",
    "",
    ...scanned,
  ].join("\n");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
