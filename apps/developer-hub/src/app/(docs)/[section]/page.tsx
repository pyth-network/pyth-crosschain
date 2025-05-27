export { LandingPage as default } from "../../../components/Pages/LandingPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { source } from "../../../source";

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ section: string }>;
}) {
  const params = await props.params;
  const page = source.getPage([params.section]);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}
