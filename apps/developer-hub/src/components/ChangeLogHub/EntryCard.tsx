import clsx from "clsx";

import type { ChangelogType } from "../../lib/changelog";
import {
  AREA_LABELS,
  fmtEntryDate,
  PRODUCT_LABELS,
  TYPE_LABELS,
} from "../../lib/changelog";
import { EntryCopyLink } from "./EntryCopyLink";
import styles from "./index.module.scss";
import type { ProductUpdatesEntry } from "./ProductUpdates";

const KIND_CLASS: Record<ChangelogType, string | undefined> = {
  "breaking-change": styles.kindBreaking,
  deprecation: styles.kindDeprecation,
  docs: styles.kindDocs,
  feature: styles.kindFeature,
  fix: styles.kindFix,
};

export const EntryCard = ({
  entry,
  isHighlighted,
}: {
  entry: ProductUpdatesEntry;
  isHighlighted: boolean;
}) => (
  <article
    className={clsx(styles.rel, isHighlighted && styles.entryCardHighlighted)}
    id={entry.slug}
  >
    <div className={styles.aside}>
      <EntryCopyLink
        date={fmtEntryDate(entry.date)}
        relative={entry.relative}
        slug={entry.slug}
      />
      <span className={clsx(styles.kind, KIND_CLASS[entry.type])}>
        {TYPE_LABELS[entry.type]}
      </span>
      <div className={styles.who}>
        {PRODUCT_LABELS[entry.product]}
        {entry.area !== undefined && (
          <>
            <span className={styles.whoDot}>·</span>
            {AREA_LABELS[entry.area]}
          </>
        )}
      </div>
    </div>
    <div className={styles.content}>
      <h3 className={styles.entryTitle}>
        <a href={`#${entry.slug}`}>{entry.title}</a>
      </h3>
      <div className={styles.entryBody}>{entry.body}</div>
    </div>
  </article>
);
