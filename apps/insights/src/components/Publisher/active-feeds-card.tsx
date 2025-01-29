"use client";

import { StatCard } from "@pythnetwork/component-library/StatCard";
import { useSelectedLayoutSegment } from "next/navigation";

import { FormattedNumber } from "../FormattedNumber";
import { Meter } from "../Meter";

type Props = {
  publisherKey: string;
  activeFeeds: number;
  totalFeeds: number;
};

export const ActiveFeedsCard = ({
  publisherKey,
  activeFeeds,
  totalFeeds,
}: Props) => {
  const layoutSegment = useSelectedLayoutSegment();

  return (
    <StatCard
      header1="Active Feeds"
      header2="Inactive Feeds"
      stat1={activeFeeds}
      stat2={totalFeeds - activeFeeds}
      miniStat1={
        <>
          <FormattedNumber
            maximumFractionDigits={1}
            value={(100 * activeFeeds) / totalFeeds}
          />
          %
        </>
      }
      miniStat2={
        <>
          <FormattedNumber
            maximumFractionDigits={1}
            value={(100 * (totalFeeds - activeFeeds)) / totalFeeds}
          />
          %
        </>
      }
      {...(layoutSegment !== "price-feeds" && {
        href: `/publishers/${publisherKey}/price-feeds`,
      })}
    >
      <Meter value={activeFeeds} maxValue={totalFeeds} label="Active Feeds" />
    </StatCard>
  );
};
