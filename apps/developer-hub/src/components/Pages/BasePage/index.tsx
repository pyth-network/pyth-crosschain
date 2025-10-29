import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import { source } from "../../../lib/source";
import { getMDXComponents } from "../../../mdx-components";

export function BasePage(props: { params: { slug: string[] } }) {
  const page = source.getPage(props.params.slug);
  if (!page) notFound();
  // @ts-expect-error - body is a property of PageData, but not defined in the types
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const MDX = page.data.body;
  return (
    // @ts-expect-error - toc and full are properties of PageData, but not defined in the types so we need to cast to any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
