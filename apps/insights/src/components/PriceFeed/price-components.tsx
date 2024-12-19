import { Badge } from "@pythnetwork/component-library/Badge";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PriceComponentDrawer } from "./price-component-drawer";
import { PriceComponentsCard } from "./price-components-card";
import styles from "./price-components.module.scss";
import { getRankings } from "../../services/clickhouse";
import { getData } from "../../services/pyth";
import { FormattedNumber } from "../FormattedNumber";
import { PublisherTag } from "../PublisherTag";
import { Score } from "../Score";

const PUBLISHER_SCORE_WIDTH = 24;

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
          score: (
            <Score score={ranking.final_score} width={PUBLISHER_SCORE_WIDTH} />
          ),
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
          uptimeScore: (
            <FormattedNumber
              value={ranking.uptime_score}
              maximumSignificantDigits={5}
            />
          ),
          deviationPenalty: ranking.deviation_penalty ? (
            <FormattedNumber
              value={ranking.deviation_penalty}
              maximumSignificantDigits={5}
            />
          ) : // eslint-disable-next-line unicorn/no-null
          null,
          deviationScore: (
            <FormattedNumber
              value={ranking.deviation_score}
              maximumSignificantDigits={5}
            />
          ),
          stalledPenalty: (
            <FormattedNumber
              value={ranking.stalled_penalty}
              maximumSignificantDigits={5}
            />
          ),
          stalledScore: (
            <FormattedNumber
              value={ranking.stalled_score}
              maximumSignificantDigits={5}
            />
          ),
        }))}
        nameLoadingSkeleton={<PublisherTag isLoading />}
        scoreLoadingSkeleton={<Score isLoading width={PUBLISHER_SCORE_WIDTH} />}
        scoreWidth={PUBLISHER_SCORE_WIDTH}
      />
      <PriceComponentDrawer>{children}</PriceComponentDrawer>
    </>
  ) : (
    notFound()
  );
};
