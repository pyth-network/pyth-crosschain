import { NextResponse } from "next/server";

import { LLM_FILES } from "../../data/llm-files";
import tokenData from "../../data/llm-token-counts.json";

export const revalidate = false;

const tokenFiles = tokenData.files as Record<
  string,
  { bytes: number; hash: string; tokens: number }
>;

export function GET() {
  const files = LLM_FILES.filter((f) => !f.deprecated).map((f) => {
    const data = tokenFiles[f.path];
    return {
      cache_max_age: f.cacheMaxAge,
      content_hash: data?.hash ?? "",
      description: f.description,
      path: f.path,
      tier: f.tier,
      title: f.title,
      token_count: data?.tokens ?? 0,
      topics: f.topics,
    };
  });

  const manifest = {
    base_url: "https://docs.pyth.network",
    description:
      "Decentralized oracle network for price feeds, randomness, and MEV protection",
    files,
    generated_at: tokenData.generated_at,
    name: "Pyth Network",
    page_access: {
      description:
        "Append .mdx to any documentation URL for plain markdown content",
      example: "https://docs.pyth.network/price-feeds/core/getting-started.mdx",
      pattern: "https://docs.pyth.network/{path}.mdx",
    },
    tokenizer: tokenData.tokenizer,
    tokenizer_note: tokenData.tokenizer_note,
    version: "1.0",
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "application/json; charset=utf-8",
    },
    status: 200,
  });
}
