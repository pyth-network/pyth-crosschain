import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import clsx from "clsx";
import { type ComponentProps, createElement } from "react";
import { z } from "zod";

import { columns } from "./columns";
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
      label="Publishers"
      columns={columns}
      publishers={publishers.map(({ key, rank, numSymbols }) => ({
        key,
        rank,
        data: {
          name: <PublisherName>{key}</PublisherName>,
          rank: <Ranking>{rank}</Ranking>,
          activeFeeds: <span className="text-sm">{numSymbols}</span>,
          inactiveFeeds: (
            <span className="text-sm">{feedCount - numSymbols}</span>
          ),
          score: 0,
        },
      }))}
    />
  );
};

const PublisherName = ({ children }: { children: string }) => {
  const knownPublisher = lookupPublisher(children);
  return knownPublisher ? (
    <div className="flex flex-row items-center gap-4">
      {createElement(knownPublisher.icon.color, {
        className: "flex-none size-9",
      })}
      <div className="space-y-1">
        <div className="text-sm font-medium">{knownPublisher.name}</div>
        <CopyButton className="text-xs" text={children}>
          {children}
        </CopyButton>
      </div>
    </div>
  ) : (
    <CopyButton className="text-xs" text={children}>
      {children}
    </CopyButton>
  );
};

const Ranking = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    className={clsx(
      "inline-block h-6 w-full rounded-md bg-steel-200 text-center text-sm font-medium leading-6 text-steel-800 dark:bg-steel-700 dark:text-steel-300",
      className,
    )}
    {...props}
  />
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
