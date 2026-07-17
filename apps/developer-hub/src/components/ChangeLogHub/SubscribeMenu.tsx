"use client";

import { CaretDown, RssSimple } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

import { feedUrl } from "../../lib/changelog";
import styles from "./index.module.scss";

const FEEDS: { label: string; href: string }[] = [
  { href: feedUrl(), label: "All products" },
  { href: feedUrl("pyth-pro"), label: "Pyth Pro" },
  { href: feedUrl("pyth-core"), label: "Pyth Core" },
  { href: feedUrl("entropy"), label: "Entropy" },
];

// RSS subscribe popover in the changelog hero — one feed per product plus an
// all-products feed.
export const SubscribeMenu = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger so keyboard focus is never stranded on a
        // link that is about to unmount.
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.subscribe} ref={rootRef}>
      <button
        aria-expanded={open}
        className={styles.subscribeButton}
        onClick={() => {
          setOpen((o) => !o);
        }}
        ref={buttonRef}
        type="button"
      >
        <RssSimple aria-hidden="true" size={14} weight="bold" />
        <span>Subscribe</span>
        <CaretDown aria-hidden="true" size={12} weight="bold" />
      </button>
      {open && (
        <div
          aria-labelledby="changelog-subscribe-heading"
          className={styles.subscribeMenu}
          role="group"
        >
          <span
            className={styles.subscribeHeading}
            id="changelog-subscribe-heading"
          >
            RSS feeds
          </span>
          {FEEDS.map(({ label, href }) => (
            <a className={styles.subscribeItem} href={href} key={href}>
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
