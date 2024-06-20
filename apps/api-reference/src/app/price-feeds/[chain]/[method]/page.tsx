import { evaluate } from "@mdx-js/mdx";
import { notFound } from "next/navigation";
import * as runtime from "react/jsx-runtime";

import { apis } from "../../../../apis";
import { useMDXComponents } from "../../../../mdx-components";

type Props = {
  params: {
    chain: string;
    method: string;
  };
};

const Page = async ({ params }: Props) => {
  const mdxComponents = useMDXComponents({});
  const chain = isKeyOf(params.chain, apis) ? apis[params.chain] : undefined;
  const api =
    chain && isKeyOf(params.method, chain) ? chain[params.method] : undefined;
  if (api) {
    // @ts-expect-error for some reason these types aren't unifying, it's
    // probably a dependency versioning issue
    const { default: Description } = await evaluate(api.description, runtime);
    return <Description components={mdxComponents} />;
  } else {
    notFound();
  }
};
export default Page;

const isKeyOf = <T extends Record<string, unknown>>(
  value: unknown,
  obj: T,
): value is keyof T => typeof value === "string" && value in obj;

export const generateStaticParams = () =>
  Object.entries(apis).flatMap(([chain, methods]) =>
    Object.keys(methods).map((method) => ({ chain, method })),
  );

export const dynamicParams = false;
