import { lookup } from "@pythnetwork/known-publishers";
import type { Metadata } from "next";

export { PublisherLayout as default } from "../../../../components/Publisher/layout";

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { key } = await params;
  const knownPublisher = lookup(key);
  const publisher = knownPublisher?.name ?? key;

  return {
    title: publisher,
    description: `Evaluate performance for data published by ${publisher}.`,
  };
};

export const revalidate = 3600;
