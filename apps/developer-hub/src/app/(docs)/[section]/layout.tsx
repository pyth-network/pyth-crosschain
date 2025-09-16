import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { docsOptions } from "../../../config/layout.config";

export default async function Layout({
  children,
  ...props
}: {
  children: ReactNode;
  params: Promise<{ section: string }>;
}) {
  const params = await props.params;
  const options = { ...docsOptions };
  options.sidebar = {
    ...options.sidebar,
    // {} (empty object) means true
    tabs: params.section === "price-feeds" ? {} : false,
  };
  return <DocsLayout {...options}>{children}</DocsLayout>;
}
