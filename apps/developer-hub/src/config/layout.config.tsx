import { Logo } from "@pythnetwork/component-library/Header";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../lib/source";

export const baseOptions: BaseLayoutProps = {
  nav: {
    enabled: true,
    title: (
      <>
        <Logo width="1em" height="1em" />
        Developer Hub
      </>
    ),
  },
  // these are commented out because we don't have the app shell anymore
  // themeSwitch: {
  //   enabled: false, // Keep this false as the theme switch is handled by the component library
  // },
  // searchToggle: {
  //   enabled: false,
  // },
};

export const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  sidebar: {
    // these are commented out because we don't have the app shell anymore
    // tabs: false,
    // collapsible: false,
  },
};
