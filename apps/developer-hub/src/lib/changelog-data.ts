// Server-side access to the changelog entry collection (one MDX file per
// entry under `content/changelog/`, compiled by fumadocs-mdx at build time).
// Importing this module pulls in the generated `.source` bundle — use it from
// server components and route handlers only, never from client components.

import { changelog } from "../../.source/server";
import type { ChangelogEntryMeta } from "./changelog";
import { compareEntriesForDisplay, slugFromPath } from "./changelog";

type CollectionEntry = (typeof changelog)[number];

export type ChangelogEntry = ChangelogEntryMeta & {
  /** Compiled MDX body, renderable as `<entry.body components={...} />`. */
  body: CollectionEntry["body"];
};

// The collection is bundled at build time, so this is a synchronous read of
// a constant — no fetching, loading, or error states needed at the call site.
// Ordering and slug derivation live in the pure `./changelog` module so they
// can be unit-tested without the `.source` build artifact.
export const getChangelogEntries = (): ChangelogEntry[] =>
  changelog
    .map((entry) => ({
      area: entry.area,
      body: entry.body,
      date: entry.date,
      product: entry.product,
      slug: slugFromPath(entry.info.path),
      title: entry.title,
      type: entry.type,
    }))
    .sort(compareEntriesForDisplay);
