"use client";

import { RssSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Popover } from "@pythnetwork/component-library/Popover";

import { feedUrl } from "../../lib/changelog";
import styles from "./index.module.scss";

const FEEDS: { label: string; href: string }[] = [
  { href: feedUrl(), label: "All products" },
  { href: feedUrl("pyth-pro"), label: "Pyth Pro" },
  { href: feedUrl("pyth-core"), label: "Pyth Core" },
  { href: feedUrl("entropy"), label: "Entropy" },
];

// Solid violet primary (Lazer `cta`-style) Subscribe, opening a Popover of
// per-product RSS feeds.
export const SubscribeMenu = () => (
  <div className={styles.subscribe}>
    <Popover
      dialogProps={{ "aria-label": "RSS feeds" }}
      popoverContents={
        <div
          aria-label="RSS feeds"
          className={styles.subscribeMenu}
          role="group"
        >
          <span className={styles.subscribeHeading}>RSS feeds</span>
          {FEEDS.map(({ label, href }) => (
            <a className={styles.subscribeItem} href={href} key={href}>
              {label}
              <span className={styles.feedTag}>RSS</span>
            </a>
          ))}
        </div>
      }
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
