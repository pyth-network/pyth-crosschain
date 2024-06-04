"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { apis } from "../../../../apis";
import { EvmCall } from "../../../../components/EvmCall";

type Props = {
  params: {
    chain: string;
    method: string;
  };
  children: ReactNode;
};

const Page = ({ params, children }: Props) => {
  const chain: (typeof apis)[keyof typeof apis] | undefined = isKeyOf(
    params.chain,
    apis,
  )
    ? apis[params.chain]
    : undefined;
  const api =
    chain && isKeyOf(params.method, chain) ? chain[params.method] : undefined;
  if (api) {
    return <EvmCall {...api}>{children}</EvmCall>;
  } else {
    notFound();
  }
};
export default Page;

const isKeyOf = <T extends Record<string, unknown>>(
  value: unknown,
  obj: T,
): value is keyof T => typeof value === "string" && value in obj;
