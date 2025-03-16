"use client";

import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { use } from "react";

import * as apis from "../../../../apis";
import { EvmApi } from "../../../../components/EvmApi";

type Props = {
  params: Promise<{
    chain: string;
    method: string;
  }>;
};

const Page = (props: Props) => {
  const params = use(props.params);
  const chain: (typeof apis)[keyof typeof apis] | undefined = isKeyOf(
    params.chain,
    apis,
  )
    ? // eslint-disable-next-line import/namespace
      apis[params.chain]
    : undefined;
  const api =
    chain && isKeyOf(params.method, chain) ? chain[params.method] : undefined;
  if (api) {
    return <EvmApi {...(api as unknown as ComponentProps<typeof EvmApi>)} />;
  } else {
    notFound();
  }
};
export default Page;

const isKeyOf = <T extends Record<string, unknown>>(
  value: unknown,
  obj: T,
): value is keyof T => typeof value === "string" && value in obj;
