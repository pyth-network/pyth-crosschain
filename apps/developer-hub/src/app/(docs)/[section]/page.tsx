export { LandingPage as default } from "../../../components/Pages/LandingPage";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CHANGELOG_PRODUCTS,
  feedUrl,
  PRODUCT_LABELS,
} from "../../../lib/changelog";
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

  // The changelog is an unlisted, product-updates page: keep it out of search
  // engines, and advertise its RSS feeds for readers that have the link.
  if (params.section === "changelog") {
    metadata.robots = { follow: false, index: false };
    metadata.alternates = {
      types: {
        "application/rss+xml": [
          { title: "Pyth Changelog", url: feedUrl() },
          ...CHANGELOG_PRODUCTS.map((product) => ({
            title: `Pyth Changelog — ${PRODUCT_LABELS[product]}`,
            url: feedUrl(product),
          })),
        ],
      },
    };
  }

  return metadata;
}
