import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getLLMText } from "../../../lib/get-llm-text";
import { source } from "../../../lib/source";

export const revalidate = false;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    return new NextResponse("Page not found", { status: 404 });
  }

  let content: string;
  try {
    content = await getLLMText(page);
  } catch {
    return new NextResponse("Error generating content for this page", {
      status: 500,
    });
  }

  return new NextResponse(content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/markdown; charset=utf-8",
    },
    status: 200,
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
