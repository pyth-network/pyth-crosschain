import { relativeDate } from "../../lib/changelog";
import { getChangelogEntries } from "../../lib/changelog-data";
import { getMDXComponents } from "../../mdx-components";
import styles from "./index.module.scss";
import type { ProductUpdatesEntry } from "./ProductUpdates";
import { ProductUpdates } from "./ProductUpdates";
import { SubscribeMenu } from "./SubscribeMenu";

// Server component: loads the hand-authored changelog entry collection at build
// time, renders each entry's MDX body, and hands the result to the client
// product-updates feed. The composed header (title + description + Subscribe)
// replaces the shell's DocsTitle/DocsDescription, which BasePage omits for this
// page. The automated market-data changelog is a separate, public page
// (`/price-feeds/changelog`) and is intentionally not shown here.
export const ChangeLogHub = () => {
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

  return (
    <div className={styles.root}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Changelog</h1>
          <p className={styles.pageDesc}>
            Product updates across Pyth Pro, Pyth Core, and Entropy.
          </p>
        </div>
        <SubscribeMenu />
      </header>
      <ProductUpdates entries={entries} />
    </div>
  );
};
