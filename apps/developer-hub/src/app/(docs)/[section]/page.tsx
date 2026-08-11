export { LandingPage as default } from "../../../components/Pages/LandingPage";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  feedUrl,
  PRODUCT_LABELS,
  TYPE_LABELS,
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

  const base: Metadata = {
    description: page.data.description,
    title: page.data.title,
  };

  if (params.section !== "changelog") {
    return base;
  }

  // The changelog is an unlisted, product-updates page: keep it out of search
  // engines, and advertise its RSS feeds for readers that have the link.
  return {
    ...base,
    alternates: {
      types: {
        "application/rss+xml": [
          { title: "Pyth Changelog", url: feedUrl() },
          ...CHANGELOG_PRODUCTS.map((product) => ({
            title: `Pyth Changelog — ${PRODUCT_LABELS[product]}`,
            url: feedUrl({ product }),
          })),
          ...CHANGELOG_TYPES.map((type) => ({
            title: `Pyth Changelog — ${TYPE_LABELS[type]}`,
            url: feedUrl({ type }),
          })),
        ],
      },
    },
    robots: { follow: false, index: false },
  };
}
