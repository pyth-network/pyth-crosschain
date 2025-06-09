import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { source } from "../source";

export const baseOptions: BaseLayoutProps = {
  nav: {
    enabled: false,
  },
  themeSwitch: {
    enabled: false,
  },
};

export const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  sidebar: {
    tabs: {
      transform(option, node) {
        const meta = source.getNodeMeta(node);
        if (!meta || !node.icon) return option;

        return {
          ...option,
          icon: (
            <div className="[&_svg]:size-6.5 md:[&_svg]:size-5">
              {node.icon}
            </div>
          ),
        };
      },
    },
  },
};
