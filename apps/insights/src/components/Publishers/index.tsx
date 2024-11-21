import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import clsx from "clsx";
import { type ComponentProps, createElement } from "react";
import { z } from "zod";

import styles from "./index.module.scss";
import { Results } from "./results";
import { client as clickhouseClient } from "../../clickhouse";
import { client as pythClient } from "../../pyth";
import { CopyButton } from "../CopyButton";

export const Publishers = async () => {
  const [publishers, feedCount] = await Promise.all([
    getPublishers(),
    getFeedCount(),
  ]);

  return (
    <Results
      publishers={publishers.map(({ key, rank, numSymbols }) => ({
        key,
        rank,
        data: {
          name: <PublisherName>{key}</PublisherName>,
          rank: <Ranking>{rank}</Ranking>,
          activeFeeds: numSymbols,
          inactiveFeeds: feedCount - numSymbols,
          score: 0,
        },
      }))}
    />
  );
};

const PublisherName = ({ children }: { children: string }) => {
  const knownPublisher = lookupPublisher(children);
  return knownPublisher ? (
    <div className={styles.publisherNameContainer}>
      {createElement(knownPublisher.icon.color, {
        className: styles.publisherIcon,
      })}
      <div className={styles.nameAndKey}>
        <div className={styles.publisherName}>{knownPublisher.name}</div>
        <CopyButton className={styles.publisherKey ?? ""} text={children}>
          {children}
        </CopyButton>
      </div>
    </div>
  ) : (
    <CopyButton className={styles.publisherKey ?? ""} text={children}>
      {children}
    </CopyButton>
  );
};

const Ranking = ({ className, ...props }: ComponentProps<"span">) => (
  <span className={clsx(styles.ranking, className)} {...props} />
);

const getPublishers = async () => {
  const rows = await clickhouseClient.query({
    query: "SELECT key, rank, numSymbols FROM insights_publishers",
  });
  const result = await rows.json();

  return publishersSchema.parse(result.data);
};

const getFeedCount = async () => {
  const pythData = await pythClient.getData();
  return pythData.symbols.filter(
    (symbol) =>
      (pythData.productPrice.get(symbol)?.numComponentPrices ?? 0) > 0,
  ).length;
};

const publishersSchema = z.array(
  z.strictObject({
    key: z.string(),
    rank: z.number(),
    numSymbols: z.number(),
  }),
);
