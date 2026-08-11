"use client";

import { RssSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Popover } from "@pythnetwork/component-library/Popover";

import {
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  feedUrl,
  PRODUCT_LABELS,
  TYPE_LABELS,
} from "../../lib/changelog";
import styles from "./index.module.scss";

type Feed = { label: string; href: string };

const PRODUCT_FEEDS: Feed[] = [
  { href: feedUrl(), label: "All updates" },
  ...CHANGELOG_PRODUCTS.map((product) => ({
    href: feedUrl({ product }),
    label: PRODUCT_LABELS[product],
  })),
];

const TYPE_FEEDS: Feed[] = CHANGELOG_TYPES.map((type) => ({
  href: feedUrl({ type }),
  label: TYPE_LABELS[type],
}));

const FeedGroup = ({ feeds, heading }: { feeds: Feed[]; heading: string }) => (
  <div aria-label={heading} className={styles.subscribeGroup} role="group">
    <span className={styles.subscribeHeading}>{heading}</span>
    {feeds.map(({ label, href }) => (
      <a className={styles.subscribeItem} href={href} key={href}>
        {label}
        <span className={styles.feedTag}>RSS</span>
      </a>
    ))}
  </div>
);

// Solid violet primary (Lazer `cta`-style) Subscribe, opening a Popover of RSS
// feeds narrowed by product or by change type.
export const SubscribeMenu = () => (
  <div className={styles.subscribe}>
    <Popover
      dialogProps={{ "aria-label": "RSS feeds" }}
      popoverContents={
        <div className={styles.subscribeMenu}>
          <FeedGroup feeds={PRODUCT_FEEDS} heading="By product" />
          <FeedGroup feeds={TYPE_FEEDS} heading="By type" />
        </div>
      }
      variant="menu"
    >
      <Button
        beforeIcon={<RssSimple weight="bold" />}
        size="sm"
        variant="primary"
      >
        Subscribe
      </Button>
    </Popover>
  </div>
);
