import { Button } from "@pythnetwork/component-library/Button";
import { Drawer } from "@pythnetwork/component-library/Drawer";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useRef, useCallback } from "react";
import { z } from "zod";

import styles from "./index.module.scss";
import { Cluster, ClusterToName } from "../../services/pyth";
import type { Status } from "../../status";
import { StateType, useData } from "../../use-data";
import { LiveConfidence, LivePrice, LiveComponentValue } from "../LivePrices";
import { Score } from "../Score";
import { ScoreHistory as ScoreHistoryComponent } from "../ScoreHistory";
import { Status as StatusComponent } from "../Status";

type Props = {
  onClose: () => void;
  title: ReactNode;
  headingExtra?: ReactNode | undefined;
  publisherKey: string;
  symbol: string;
  feedKey: string;
  score: number | undefined;
  rank: number | undefined;
  status: Status;
  navigateButtonText: string;
  navigateHref: string;
};

export const PriceComponentDrawer = ({
  publisherKey,
  onClose,
  symbol,
  feedKey,
  score,
  rank,
  title,
  status,
  headingExtra,
  navigateButtonText,
  navigateHref,
}: Props) => {
  const goToPriceFeedPageOnClose = useRef<boolean>(false);
  const [isFeedDrawerOpen, setIsFeedDrawerOpen] = useState(true);
  const router = useRouter();
  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setIsFeedDrawerOpen(false);
      }
    },
    [setIsFeedDrawerOpen],
  );
  const handleCloseFinish = useCallback(() => {
    if (goToPriceFeedPageOnClose.current) {
      router.push(navigateHref);
    } else {
      onClose();
    }
  }, [router, onClose, navigateHref]);
  const handleOpenFeed = useCallback(() => {
    goToPriceFeedPageOnClose.current = true;
    setIsFeedDrawerOpen(false);
  }, [setIsFeedDrawerOpen]);
  const scoreHistoryState = useData(
    [Cluster.Pythnet, publisherKey, symbol],
    getScoreHistory,
  );

  return (
    <Drawer
      onOpenChange={handleClose}
      onCloseFinish={handleCloseFinish}
      title={title}
      headingExtra={
        <>
          {headingExtra}
          <StatusComponent status={status} />
          <Button
            size="sm"
            variant="outline"
            onPress={handleOpenFeed}
            href={navigateHref}
          >
            {navigateButtonText}
          </Button>
        </>
      }
      isOpen={isFeedDrawerOpen}
      bodyClassName={styles.priceComponentDrawer}
    >
      <div className={styles.stats}>
        <StatCard
          nonInteractive
          header="Aggregate Price"
          stat={<LivePrice feedKey={feedKey} />}
        />
        <StatCard
          nonInteractive
          header="Publisher Price"
          variant="primary"
          stat={<LivePrice feedKey={feedKey} publisherKey={publisherKey} />}
        />
        <StatCard
          nonInteractive
          header="Publisher Confidence"
          small
          stat={
            <LiveConfidence feedKey={feedKey} publisherKey={publisherKey} />
          }
        />
        <StatCard
          nonInteractive
          header="Last Slot"
          small
          stat={
            <LiveComponentValue
              feedKey={feedKey}
              publisherKey={publisherKey}
              field="publishSlot"
            />
          }
        />
        <StatCard
          nonInteractive
          header="Score"
          small
          stat={score ? <Score fill score={score} /> : <></>}
        />
        <StatCard
          nonInteractive
          header="Quality Rank"
          small
          stat={rank ?? <></>}
        />
      </div>
      <ScoreHistory state={scoreHistoryState} />
    </Drawer>
  );
};

const ScoreHistory = ({
  state,
}: {
  state: ReturnType<typeof useData<z.infer<typeof scoreHistorySchema>>>;
}) => {
  switch (state.type) {
    case StateType.Loading:
    case StateType.Error:
    case StateType.NotLoaded: {
      return (
        <Spinner
          label="Loading score history"
          isIndeterminate
          className={styles.spinner ?? ""}
        />
      );
    }

    case StateType.Loaded: {
      return <ScoreHistoryComponent scoreHistory={state.data} />;
    }
  }
};

const getScoreHistory = async ([cluster, publisherKey, symbol]: [
  Cluster,
  string,
  string,
]) => {
  const url = new URL("/component-score-history", window.location.origin);
  url.searchParams.set("cluster", ClusterToName[cluster]);
  url.searchParams.set("publisherKey", publisherKey);
  url.searchParams.set("symbol", symbol);
  const data = await fetch(url);
  return scoreHistorySchema.parse(await data.json());
};

const scoreHistorySchema = z.array(
  z.strictObject({
    time: z.string().transform((value) => new Date(value)),
    score: z.number(),
    uptimeScore: z.number(),
    deviationScore: z.number(),
    stalledScore: z.number(),
  }),
);
