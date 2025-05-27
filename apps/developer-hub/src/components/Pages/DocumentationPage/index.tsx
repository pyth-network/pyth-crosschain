import { BasePage } from "../BasePage";

export async function DocumentationPage(props: {
  params: Promise<{ section: string; slug: string[] }>;
}) {
  const params = await props.params;
  return (
    <BasePage params={{ ...params, slug: [params.section, ...params.slug] }} />
  );
}
