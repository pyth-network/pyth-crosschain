"use client";

import { PythLogo, Text, ThemeSwitch } from "@pythnetwork/component-library/v2";
import { useAppTheme } from "@pythnetwork/react-hooks/use-app-theme";
import Image from "next/image";
import type { PropsWithChildren } from "react";

import { classes } from "./AuthLayout.styles";

export function AuthLayout({ children }: Readonly<PropsWithChildren>) {
  const { effectiveTheme, toggleTheme } = useAppTheme();
  return (
    <section className={classes.root}>
      <header className={classes.header}>
        <PythLogo className={classes.logo} />
        <ThemeSwitch
          checked={effectiveTheme === "light"}
          onChange={(checked) => {
            toggleTheme(checked ? "light" : "dark");
          }}
        />
      </header>
      <aside className={classes.aside}>
        <Text className={classes.tagline} size="xl5">
          Tagline here
        </Text>
        <Text size="sm">Trusted by</Text>
        <div className={classes.companies}>
          <Image
            alt="bitmex logo"
            height="16"
            src="/img/bitmex.svg"
            unoptimized
            width="96"
          />
          <Image
            alt="hyperliquid logo"
            height="19"
            src="/img/hyperliquid.svg"
            unoptimized
            width="121"
          />
          <Image
            alt="kalshi logo"
            height="19"
            src="/img/kalshi.svg"
            unoptimized
            width="72"
          />
          <Image
            alt="revolut logo"
            height="19"
            src="/img/revolut.svg"
            unoptimized
            width="84"
          />
        </div>
      </aside>
      <div className={classes.form}>{children}</div>
    </section>
  );
}
