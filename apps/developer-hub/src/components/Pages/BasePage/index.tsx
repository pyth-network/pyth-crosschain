import type { TOCItemType } from "fumadocs-core/toc";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import { getLLMText } from "../../../lib/get-llm-text";
import { source } from "../../../lib/source";
import { PageActions } from "../../PageActions";

export async function BasePage(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  // Type assertions for Fumadocs v16 compatibility
  const pageData = page.data as {
    body?: React.ComponentType;
    toc?: TOCItemType[];
    full?: boolean;
    title?: string;
    description?: string;
  };
  const MDX = pageData.body;
  const content = await getLLMText(page);
  const title = pageData.title ?? "";
  const url = page.url;

  // Hide PageActions for api-reference pages
  const isApiReference = url.startsWith("/api-reference");

  return (
    <DocsPage
      {...(pageData.toc ? { toc: pageData.toc } : {})}
      tableOfContent={{ style: "clerk" }}
      {...(pageData.full === undefined ? {} : { full: pageData.full })}
    >
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{pageData.description ?? ""}</DocsDescription>
      {!isApiReference && (
        <PageActions content={content} title={title} url={url} />
      )}
      <DocsBody>{MDX ? <MDX /> : undefined}</DocsBody>
    </DocsPage>
  );
}
