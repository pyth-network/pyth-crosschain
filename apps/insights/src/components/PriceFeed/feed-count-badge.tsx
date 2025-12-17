import { Badge } from "@pythnetwork/component-library/Badge";
import { Suspense } from "react";
import { Cluster } from "../../services/pyth";
import { LiveValue } from "../LivePrices";
import { getFeed } from "./get-feed";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const FeedCountBadge = ({ params }: Props) => (
  <Suspense>
    <FeedCountBadgeImpl params={params} />
  </Suspense>
);

const FeedCountBadgeImpl = async ({ params }: Props) => {
  const { feed } = await getFeed(params);
  return (
    <Badge size="xs" style="filled" variant="neutral">
      <LiveValue
        feedKey={feed.product.price_account}
        field="numComponentPrices"
        defaultValue={feed.price.numComponentPrices}
        cluster={Cluster.Pythnet}
      />
    </Badge>
  );
};
