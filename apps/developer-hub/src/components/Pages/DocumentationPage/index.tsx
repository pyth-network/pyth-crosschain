import { BasePage } from "../BasePage";

export async function DocumentationPage(props: {
  params: Promise<{ section: string; slug: string[] }>;
}) {
  const params = await props.params;
  params.slug.unshift(params.section);
  return BasePage({ params });
}
