import { NextResponse } from "next/server";

import { getLLMText } from "../../lib/get-llm-text";
import { source } from "../../lib/source";

export async function GET() {
  try {
    const pages = source.getPages();
    const scan = pages.map((page) => getLLMText(page));
    const scanned = await Promise.all(scan);

    const content = [
      "# Pyth Documentation",
      "",
      "This file contains the complete Pyth documentation for LLM consumption.",
      `Generated on: ${new Date().toISOString()}`,
      "",
      "## About Pyth",
      "Pyth is a decentralized price oracle network that provides real-time price feeds for a wide range of assets.",
      "",
      "---",
      "",
      ...scanned,
    ].join("\n");

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

export function HEAD() {
  return new NextResponse(undefined, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
