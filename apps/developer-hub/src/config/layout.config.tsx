import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../lib/source";

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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  tree: source.pageTree as any,
  sidebar: {
    tabs: false,
    collapsible: false,
  },
};
