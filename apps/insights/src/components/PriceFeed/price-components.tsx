import { Badge } from "@pythnetwork/component-library/Badge";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PriceComponentDrawer } from "./price-component-drawer";
import { PriceComponentsCard } from "./price-components-card";
import styles from "./price-components.module.scss";
import { getRankings } from "../../services/clickhouse";
import { getData } from "../../services/pyth";
import { PublisherTag } from "../PublisherTag";

type Props = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export const PriceComponents = async ({ children, params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const [data, rankings] = await Promise.all([getData(), getRankings(symbol)]);
  const feed = data.find((feed) => feed.symbol === symbol);

  return feed ? (
    <>
      <PriceComponentsCard
        slug={slug}
        priceComponents={rankings.map((ranking) => ({
          id: ranking.publisher,
          publisherNameAsString: lookupPublisher(ranking.publisher)?.name,
          score: ranking.final_score,
          name: (
            <div className={styles.publisherName}>
              <PublisherTag publisherKey={ranking.publisher} />
              {ranking.cluster === "pythtest-conformance" && (
                <Badge variant="muted" style="filled" size="xs">
                  test
                </Badge>
              )}
            </div>
          ),
          uptimeScore: ranking.uptime_score,
          deviationPenalty: ranking.deviation_penalty,
          deviationScore: ranking.deviation_score,
          stalledPenalty: ranking.stalled_penalty,
          stalledScore: ranking.stalled_score,
        }))}
        nameLoadingSkeleton={<PublisherTag isLoading />}
      />
      <PriceComponentDrawer>{children}</PriceComponentDrawer>
    </>
  ) : (
    notFound()
  );
};
