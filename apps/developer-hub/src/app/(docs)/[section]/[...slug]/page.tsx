import type { Metadata } from "next";
import { notFound } from "next/navigation";

export { DocumentationPage as default } from "../../../../components/Pages/DocumentationPage";
import { source } from "../../../../lib/source";

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ section: string; slug: string[] }>;
}) {
  const params = await props.params;

  const page = source.getPage([params.section, ...params.slug]);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
