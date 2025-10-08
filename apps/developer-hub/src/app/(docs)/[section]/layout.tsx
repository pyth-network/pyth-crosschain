import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { docsOptions } from "../../../config/layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  const options = { ...docsOptions };
  return <DocsLayout {...options}>{children}</DocsLayout>;
}
