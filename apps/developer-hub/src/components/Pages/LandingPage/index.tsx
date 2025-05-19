import { BasePage } from "../BasePage";

export async function LandingPage(props: {
  params: Promise<{ section: string }>;
}) {
  const params = await props.params;
  return <BasePage params={{ ...params, slug: [params.section] }} />;
}
