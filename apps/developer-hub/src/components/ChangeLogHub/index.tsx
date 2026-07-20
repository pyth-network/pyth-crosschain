import { relativeDate } from "../../lib/changelog";
import { getChangelogEntries } from "../../lib/changelog-data";
import { getMDXComponents } from "../../mdx-components";
import { ChangeLogView } from "../ChangeLog/ChangeLogView";
import { getChangeLog } from "../ChangeLog/data";
import { HubTabs } from "./HubTabs";
import type { ProductUpdatesEntry } from "./ProductUpdates";
import { ProductUpdates } from "./ProductUpdates";

// Server component: loads the changelog entry collection and the automated
// market-data stream at build time, renders each entry's MDX body, and hands
// everything to the client as plain data + rendered React nodes.
export const ChangeLogHub = () => {
  const marketData = getChangeLog();

  const entries: ProductUpdatesEntry[] = getChangelogEntries().map((entry) => {
    const Body = entry.body;
    return {
      area: entry.area,
      body: <Body components={getMDXComponents()} />,
      date: entry.date,
      product: entry.product,
      relative: relativeDate(entry.date),
      slug: entry.slug,
      title: entry.title,
      type: entry.type,
    };
  });

  // No Suspense boundary needed: the tab/filter components initialize to their
  // defaults and reconcile URL state after mount, so the full feed renders
  // straight into the static HTML rather than bailing out to client rendering.
  return (
    <HubTabs
      marketDataDates={marketData.days.map((day) => day.date)}
      marketDataPanel={<ChangeLogView log={marketData} />}
      productUpdatesPanel={<ProductUpdates entries={entries} />}
    />
  );
};
