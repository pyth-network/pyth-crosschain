import { Badge } from "@pythnetwork/component-library/Badge";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import { PublishersCard } from "./publishers-card";
import styles from "./publishers.module.scss";
import { getRankings } from "../../services/clickhouse";
import { getData } from "../../services/pyth";
import { PublisherTag } from "../PublisherTag";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const Publishers = async ({ params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const [data, rankings] = await Promise.all([getData(), getRankings(symbol)]);
  const feed = data.find((feed) => feed.symbol === symbol);

  return feed ? (
    <PublishersCard
      defaultSort="score"
      defaultDescending
      priceComponents={rankings.map((ranking) => ({
        id: ranking.publisher,
        nameAsString: lookupPublisher(ranking.publisher)?.name,
        score: ranking.final_score,
        isTest: ranking.cluster === "pythtest-conformance",
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
  ) : (
    notFound()
  );
};
