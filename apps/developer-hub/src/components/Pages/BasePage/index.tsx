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
import { PageActions } from "../../PageActions";

export async function BasePage(props: { params: { slug: string[] } }) {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const content = await getLLMText(page);
  const title = page.data.title;
  const url = page.url;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{ style: "clerk" }}
      full={page.data.full}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions content={content} title={title} url={url} />
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
