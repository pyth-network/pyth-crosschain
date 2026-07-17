import clsx from "clsx";

import type { ChangelogType } from "../../lib/changelog";
import { AREA_LABELS, PRODUCT_LABELS, TYPE_LABELS } from "../../lib/changelog";
import { EntryCopyLink } from "./EntryCopyLink";
import styles from "./index.module.scss";
import type { ProductUpdatesEntry } from "./ProductUpdates";

const TYPE_BADGE_CLASS: Record<ChangelogType, string | undefined> = {
  "breaking-change": styles.typeBadgeBreaking,
  deprecation: styles.typeBadgeDeprecation,
  docs: styles.typeBadgeDocs,
  feature: styles.typeBadgeFeature,
  fix: styles.typeBadgeFix,
};

export const EntryCard = ({
  entry,
  isHighlighted,
}: {
  entry: ProductUpdatesEntry;
  isHighlighted: boolean;
}) => (
  <article
    className={clsx(
      styles.entryCard,
      isHighlighted && styles.entryCardHighlighted,
    )}
    id={entry.slug}
  >
    <header className={styles.entryHeader}>
      <span className={clsx(styles.typeBadge, TYPE_BADGE_CLASS[entry.type])}>
        {TYPE_LABELS[entry.type]}
      </span>
      <span className={styles.productTag}>{PRODUCT_LABELS[entry.product]}</span>
      {entry.area !== undefined && (
        <span className={styles.areaTag}>{AREA_LABELS[entry.area]}</span>
      )}
      <EntryCopyLink slug={entry.slug} title={entry.title} />
    </header>
    <h3 className={styles.entryTitle}>{entry.title}</h3>
    <div className={styles.entryBody}>{entry.body}</div>
  </article>
);
