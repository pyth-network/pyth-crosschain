import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../lib/source";

export const baseOptions: BaseLayoutProps = {
  nav: {
    enabled: true,
  },
  themeSwitch: {
    enabled: false, // Keep this false as the theme switch is handled by the component library
  },
  searchToggle: {
    enabled: false,
  },
};

export const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  sidebar: {
    tabs: false,
    collapsible: false,
  },
};
