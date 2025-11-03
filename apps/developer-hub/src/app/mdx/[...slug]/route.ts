import { NextRequest, NextResponse } from "next/server";

import { getLLMText } from "../../../lib/get-llm-text";
import { source } from "../../../lib/source";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    return new NextResponse("Page not found", { status: 404 });
  }

  const content = await getLLMText(page);

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}
