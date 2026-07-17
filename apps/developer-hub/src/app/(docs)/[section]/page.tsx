export { LandingPage as default } from "../../../components/Pages/LandingPage";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { source } from "../../../lib/source";

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ section: string }>;
}) {
  const params = await props.params;
  const page = source.getPage([params.section]);

  if (!page) notFound();

  const metadata: Metadata = {
    description: page.data.description,
    title: page.data.title,
  };

  // Advertise the changelog RSS feeds so reader extensions and "paste the page
  // URL" flows can auto-discover them from /changelog itself.
  if (params.section === "changelog") {
    metadata.alternates = {
      types: {
        "application/rss+xml": [
          { title: "Pyth Changelog", url: "/changelog/feed.xml" },
          {
            title: "Pyth Changelog — Pyth Pro",
            url: "/changelog/feed.xml?product=pyth-pro",
          },
          {
            title: "Pyth Changelog — Pyth Core",
            url: "/changelog/feed.xml?product=pyth-core",
          },
          {
            title: "Pyth Changelog — Entropy",
            url: "/changelog/feed.xml?product=entropy",
          },
        ],
      },
    };
  }

  return metadata;
}
