import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../lib/source";

export const baseOptions: BaseLayoutProps = {
  nav: {
    enabled: true,
    title: (
      // todo change the logo here
      <>
        <svg
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Logo"
        >
          <circle cx={12} cy={12} r={12} fill="currentColor" />
        </svg>
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
