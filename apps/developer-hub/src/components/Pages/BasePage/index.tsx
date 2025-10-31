import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import { getLLMText } from "../../../lib/get-llm-text";
import { source } from "../../../lib/source";
import { getMDXComponents } from "../../../mdx-components";
import { LLMShare } from "../../LLMShare";

export async function BasePage(props: { params: { slug: string[] } }) {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const content = await getLLMText(page);
  const title = page.data.title;
  const url = page.url;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="flex items-center justify-between gap-4">
        <DocsTitle>{page.data.title}</DocsTitle>
        <LLMShare content={content} title={title} url={url} />
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
