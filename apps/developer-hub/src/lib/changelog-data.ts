// Server-side access to the changelog entry collection (one MDX file per
// entry under `content/changelog/`, compiled by fumadocs-mdx at build time).
// Importing this module pulls in the generated `.source` bundle — use it from
// server components and route handlers only, never from client components.

import { changelog } from "../../.source/server";
import type { ChangelogEntryMeta } from "./changelog";

type CollectionEntry = (typeof changelog)[number];

export type ChangelogEntry = ChangelogEntryMeta & {
  /** Compiled MDX body, renderable as `<entry.body components={...} />`. */
  body: CollectionEntry["body"];
};

const slugOf = (entry: CollectionEntry): string =>
  entry.info.path.replace(/\.mdx$/, "");

// The collection is bundled at build time, so this is a synchronous read of
// a constant — no fetching, loading, or error states needed at the call site.
export const getChangelogEntries = (): ChangelogEntry[] =>
  changelog
    .map((entry) => ({
      area: entry.area,
      body: entry.body,
      date: entry.date,
      product: entry.product,
      slug: slugOf(entry),
      title: entry.title,
      type: entry.type,
    }))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    );
