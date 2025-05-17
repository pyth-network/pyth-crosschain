import { DocumentationPage } from "@/src/components/Pages/DocumentationPage";
import { source } from "@/src/source";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
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

export default DocumentationPage;
