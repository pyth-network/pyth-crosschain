import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../source";

export const baseOptions: BaseLayoutProps = {
  nav: {
    enabled: true,
  },
  themeSwitch: {
    enabled: false,
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
  },
};
