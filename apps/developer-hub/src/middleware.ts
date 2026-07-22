import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SKIP_PREFIXES = [
  "/_next",
  "/api",
  "/playground",
  "/mdx",
];

const SKIP_EXACT = new Set([
  "/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/llms-manifest.json",
  "/llms-entropy.txt",
  "/llms-price-feeds.txt",
  "/llms-price-feeds-core.txt",
  "/llms-price-feeds-pro.txt",
  "/SKILL.md",
]);

function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const entries = accept.split(",").map((part) => {
    const [media = "", ...params] = part.trim().split(";").map((s) => s.trim());
    const qParam = params.find((p) => p.startsWith("q="));
    const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
    return { media, q: Number.isFinite(q) ? q : 1 };
  });
  const markdown = entries.find(
    (e) => e.media === "text/markdown" || e.media === "text/x-markdown",
  );
  if (!markdown) return false;
  const html = entries.find((e) => e.media === "text/html");
  return !html || markdown.q >= html.q;
}

export function middleware(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  if (!prefersMarkdown(request.headers.get("accept"))) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (SKIP_EXACT.has(pathname)) return NextResponse.next();
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Already a .md/.mdx URL — let the existing rewrite handle it.
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/mdx${pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("Vary", "Accept");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico).*)",
  ],
};
