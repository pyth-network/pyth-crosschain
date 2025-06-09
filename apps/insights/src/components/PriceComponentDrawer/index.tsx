import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Flask } from "@phosphor-icons/react/dist/ssr/Flask";
import type { Props as ButtonProps } from "@pythnetwork/component-library/Button";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Select } from "@pythnetwork/component-library/Select";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Table } from "@pythnetwork/component-library/Table";
import type { Button as UnstyledButton } from "@pythnetwork/component-library/unstyled/Button";
import { StateType, useData } from "@pythnetwork/component-library/useData";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useMountEffect } from "@react-hookz/web";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import type { ReactNode } from "react";
import {
  Suspense,
  useState,
  useCallback,
  useMemo,
  useTransition,
  useRef,
} from "react";
import {
  RouterProvider,
  useDateFormatter,
  useNumberFormatter,
} from "react-aria";
import { ResponsiveContainer, Tooltip, Line, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";
import { z } from "zod";

import styles from "./index.module.scss";
import { Cluster, ClusterToName } from "../../services/pyth";
import type { Status } from "../../status";
import { LiveConfidence, LivePrice, LiveComponentValue } from "../LivePrices";
import { PriceName } from "../PriceName";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";

const LineChart = dynamic(
  () => import("recharts").then((recharts) => recharts.LineChart),
  {
    ssr: false,
  },
);

type PriceComponent = {
  name: ReactNode;
  publisherKey: string;
  symbol: string;
  displaySymbol: string;
  assetClass: string;
  feedKey: string;
  score: number | undefined;
  rank: number | undefined;
  status: Status;
  identifiesPublisher?: boolean | undefined;
  firstEvaluation?: Date | undefined;
  cluster: Cluster;
};

export const usePriceComponentDrawer = ({
  components,
  identifiesPublisher,
}: {
  components: PriceComponent[];
  identifiesPublisher?: boolean | undefined;
}) => {
  const logger = useLogger();
  const drawer = useDrawer();
  const router = useRouter();
  const [isRouting, startTransition] = useTransition();
  const didRestoreUrl = useRef(false);

  const navigate = useCallback(
    (route: string) => {
      startTransition(() => {
        router.push(route);
        drawer.close().catch((error: unknown) => {
          logger.error(error);
        });
      });
    },
    [router, startTransition, logger, drawer],
  );

  const [selectedComponentId, setSelectedComponentId] = useQueryState(
    identifiesPublisher ? "publisher" : "priceFeed",
    parseAsString.withDefault(""),
  );

  const updateSelectedComponentId = useCallback(
    (componentId: string) => {
      if (!isRouting) {
        setSelectedComponentId(componentId).catch((error: unknown) => {
          logger.error(error);
        });
      }
    },
    [setSelectedComponentId, isRouting, logger],
  );

  const clearSelectedComponent = useCallback(() => {
    updateSelectedComponentId("");
  }, [updateSelectedComponentId]);

  useMountEffect(() => {
    if (selectedComponentId && !didRestoreUrl.current) {
      didRestoreUrl.current = true;
      const component = components.find(
        (component) =>
          component[identifiesPublisher ? "publisherKey" : "feedKey"] ===
          selectedComponentId,
      );
      if (component) {
        openDrawer(component);
      }
    }
  });

  const openDrawer = useCallback(
    (component: PriceComponent) => {
      drawer.open({
        title: component.name,
        className: styles.priceComponentDrawer ?? "",
        bodyClassName: styles.priceComponentDrawerBody ?? "",
        onClose: clearSelectedComponent,
        headingExtra: (
          <RouterProvider navigate={navigate}>
            <HeadingExtra
              identifiesPublisher={identifiesPublisher}
              status={component.status}
              cluster={component.cluster}
              publisherKey={component.publisherKey}
              symbol={component.symbol}
            />
          </RouterProvider>
        ),
        headingAfter: (
          <div className={styles.badges}>
            <StatusComponent status={component.status} />
          </div>
        ),
        contents: (
          <RouterProvider navigate={navigate}>
            {component.cluster === Cluster.PythtestConformance && (
              <InfoBox
                icon={<Flask />}
                header={`This publisher is in test`}
                className={styles.testFeedMessage}
              >
                This is a test publisher. Its prices are not included in the
                Pyth aggregate price for {component.displaySymbol}.
              </InfoBox>
            )}
            <div className={styles.stats}>
              <StatCard
                nonInteractive
                header={
                  <>
                    Aggregated <PriceName assetClass={component.assetClass} />
                  </>
                }
                small
                stat={
                  <LivePrice
                    feedKey={component.feedKey}
                    cluster={component.cluster}
                  />
                }
              />
              <StatCard
                nonInteractive
                header={
                  <>
                    Publisher <PriceName assetClass={component.assetClass} />
                  </>
                }
                variant="primary"
                small
                stat={
                  <LivePrice
                    feedKey={component.feedKey}
                    publisherKey={component.publisherKey}
                    cluster={component.cluster}
                  />
                }
              />
              <StatCard
                nonInteractive
                header="Publisher Confidence"
                small
                stat={
                  <LiveConfidence
                    feedKey={component.feedKey}
                    publisherKey={component.publisherKey}
                    cluster={component.cluster}
                  />
                }
              />
              <StatCard
                nonInteractive
                header="Last Slot"
                small
                stat={
                  <LiveComponentValue
                    feedKey={component.feedKey}
                    publisherKey={component.publisherKey}
                    field="publishSlot"
                    cluster={component.cluster}
                  />
                }
              />
              <StatCard
                nonInteractive
                header="Score"
                small
                stat={
                  component.score ? (
                    <Score fill score={component.score} />
                  ) : (
                    <></>
                  )
                }
              />
              <StatCard
                nonInteractive
                header="Quality Rank"
                small
                stat={component.rank ?? <></>}
              />
            </div>
            {component.firstEvaluation && (
              <ScoreBreakdown
                firstEvaluation={component.firstEvaluation}
                cluster={component.cluster}
                publisherKey={component.publisherKey}
                symbol={component.symbol}
              />
            )}
          </RouterProvider>
        ),
      });
    },
    [clearSelectedComponent, drawer, identifiesPublisher, navigate],
  );

  const selectComponent = useCallback(
    (component: PriceComponent) => {
      updateSelectedComponentId(
        component[identifiesPublisher ? "publisherKey" : "feedKey"],
      );
      openDrawer(component);
    },
    [updateSelectedComponentId, openDrawer, identifiesPublisher],
  );

  return { selectComponent };
};

type HeadingExtraProps = {
  status: Status;
  identifiesPublisher?: boolean | undefined;
  cluster: Cluster;
  publisherKey: string;
  symbol: string;
};

const HeadingExtra = ({ status, ...props }: HeadingExtraProps) => {
  return (
    <>
      <div className={styles.bigScreenBadges}>
        <StatusComponent status={status} />
      </div>
      <OpenButton
        variant="ghost"
        hideText
        beforeIcon={<ArrowSquareOut />}
        rounded
        className={styles.ghostOpenButton ?? ""}
        {...props}
      />
      <OpenButton
        variant="outline"
        className={styles.outlineOpenButton ?? ""}
        {...props}
      />
    </>
  );
};

type OpenButtonProps = Omit<ButtonProps<typeof UnstyledButton>, "children"> & {
  identifiesPublisher?: boolean | undefined;
  cluster: Cluster;
  publisherKey: string;
  symbol: string;
};

const OpenButton = ({
  identifiesPublisher,
  cluster,
  publisherKey,
  symbol,
  ...props
}: OpenButtonProps) => {
  const href = useMemo(
    () =>
      identifiesPublisher
        ? `/publishers/${ClusterToName[cluster]}/${publisherKey}`
        : `/price-feeds/${encodeURIComponent(symbol)}`,
    [identifiesPublisher, cluster, publisherKey, symbol],
  );

  return (
    <Button size="sm" href={href} {...props}>
      Open {identifiesPublisher ? "Publisher" : "Feed"}
    </Button>
  );
};

type ScoreBreakdownProps = {
  firstEvaluation: Date;
  cluster: Cluster;
  publisherKey: string;
  symbol: string;
};

const ScoreBreakdown = ({
  firstEvaluation,
  cluster,
  publisherKey,
  symbol,
}: ScoreBreakdownProps) => {
  const { selectedPeriod, setSelectedPeriod, evaluationPeriods } =
    useEvaluationPeriods(firstEvaluation);
  const scoreHistoryState = useData(
    [cluster, publisherKey, symbol, selectedPeriod],
    getScoreHistory,
  );

  return (
    <Card
      title="Score Breakdown"
      nonInteractive
      className={styles.rankingBreakdown}
      toolbar={
        <Select
          size="sm"
          variant="outline"
          hideLabel
          label="Evaluation Period"
          selectedKey={selectedPeriod.label}
          onSelectionChange={(label) => {
            const evaluationPeriod = evaluationPeriods.find(
              (period) => period.label === label,
            );
            if (evaluationPeriod) {
              setSelectedPeriod(evaluationPeriod);
            }
          }}
          options={evaluationPeriods.map(({ label }) => ({ id: label }))}
          placement="bottom end"
        />
      }
    >
      <ScoreHistory state={scoreHistoryState} />
    </Card>
  );
};

const useEvaluationPeriods = (firstEvaluation: Date) => {
  const dateFormatter = useDateFormatter({
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const evaluationPeriods = useMemo<
    [EvaluationPeriod, ...EvaluationPeriod[]]
  >(() => {
    const evaluations: EvaluationPeriod[] = [];
    const today = new Date();
    const cursor = new Date(firstEvaluation);
    cursor.setHours(0);
    cursor.setMinutes(0);
    cursor.setSeconds(0);
    cursor.setMilliseconds(0);
    // Evaluations are between the 16th of one month and the 15th of the next
    // month, so move the cursor to the first evaluation boundary before the
    // first evaluation.
    if (cursor.getDate() < 16) {
      cursor.setMonth(cursor.getMonth() - 1);
    }
    cursor.setDate(16);
    while (cursor < today) {
      const start = new Date(cursor);
      cursor.setMonth(cursor.getMonth() + 1);
      const end = new Date(cursor);
      end.setDate(15);
      evaluations.unshift({
        start,
        end,
        label: `${dateFormatter.format(start)} to ${end < today ? dateFormatter.format(end) : "Now"}`,
      });
    }

    // This ensures that typescript understands that this array is nonempty
    const [head, ...tail] = evaluations;
    if (!head) {
      throw new Error("Failed invariant: No first evaluation!");
    }
    return [head, ...tail];
  }, [firstEvaluation, dateFormatter]);

  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod>(
    evaluationPeriods[0],
  );

  return { selectedPeriod, setSelectedPeriod, evaluationPeriods };
};

type EvaluationPeriod = {
  start: Date;
  end: Date;
  label: string;
};

type ScoreHistoryProps = {
  state: ReturnType<typeof useData<z.infer<typeof scoreHistorySchema>>>;
};

const ScoreHistory = ({ state }: ScoreHistoryProps) => {
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
      return <ResolvedScoreHistory scoreHistory={state.data} />;
    }
  }
};

const getScoreHistory = async ([
  cluster,
  publisherKey,
  symbol,
  selectedPeriod,
]: [Cluster, string, string, EvaluationPeriod]) => {
  const url = new URL("/component-score-history", globalThis.location.origin);
  url.searchParams.set("cluster", ClusterToName[cluster]);
  url.searchParams.set("publisherKey", publisherKey);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", formatDate(selectedPeriod.start));
  url.searchParams.set("to", formatDate(selectedPeriod.end));
  const data = await fetch(url);
  return scoreHistorySchema.parse(await data.json());
};

const formatDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  return `${year.toString()}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
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

const CHART_HEIGHT = 104;

type ResolvedScoreHistoryProps = {
  scoreHistory: Point[];
};

type Point = {
  time: Date;
  score: number;
  uptimeScore: number;
  deviationScore: number;
  stalledScore: number;
};

const ResolvedScoreHistory = ({ scoreHistory }: ResolvedScoreHistoryProps) => {
  const [selectedPoint, setSelectedPoint] = useState<Point | undefined>(
    undefined,
  );
  const updateSelectedPoint = useCallback(
    (chart: CategoricalChartState) => {
      setSelectedPoint(
        (chart.activePayload as { payload: Point }[] | undefined)?.[0]?.payload,
      );
    },
    [setSelectedPoint],
  );
  const currentPoint = useMemo(
    () => selectedPoint ?? scoreHistory.at(-1),
    [selectedPoint, scoreHistory],
  );
  const dateFormatter = useDateFormatter({
    dateStyle: "long",
    timeZone: "UTC",
  });
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 4 });

  const [hoveredScore, setHoveredScore] = useState<ScoreComponent | undefined>(
    undefined,
  );
  const hoverUptime = useCallback(() => {
    setHoveredScore("uptime");
  }, [setHoveredScore]);
  const hoverDeviation = useCallback(() => {
    setHoveredScore("deviation");
  }, [setHoveredScore]);
  const hoverStalled = useCallback(() => {
    setHoveredScore("stalled");
  }, [setHoveredScore]);
  const hoverFinal = useCallback(() => {
    setHoveredScore("final");
  }, [setHoveredScore]);
  const clearHover = useCallback(() => {
    setHoveredScore(undefined);
  }, [setHoveredScore]);

  const [focusedScore, setFocusedScore] = useState<ScoreComponent | undefined>(
    undefined,
  );
  const toggleFocusedScore = useCallback(
    (value: typeof focusedScore) => {
      setFocusedScore((cur) => (cur === value ? undefined : value));
    },
    [setFocusedScore],
  );
  const toggleFocusUptime = useCallback(() => {
    toggleFocusedScore("uptime");
  }, [toggleFocusedScore]);
  const toggleFocusDeviation = useCallback(() => {
    toggleFocusedScore("deviation");
  }, [toggleFocusedScore]);
  const toggleFocusStalled = useCallback(() => {
    toggleFocusedScore("stalled");
  }, [toggleFocusedScore]);
  const toggleFocusFinal = useCallback(() => {
    toggleFocusedScore("final");
  }, [toggleFocusedScore]);

  return (
    <>
      <div
        className={styles.scoreHistoryChart}
        data-hovered-score={hoveredScore}
        data-focused-score={focusedScore}
      >
        <div className={styles.top}>
          <div className={styles.left}>
            <h3 className={styles.header}>
              <MainChartLabel component={hoveredScore ?? focusedScore} />
            </h3>
          </div>
        </div>
        <Suspense
          fallback={<div style={{ height: `${CHART_HEIGHT.toString()}px` }} />}
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart
              data={scoreHistory}
              className={styles.chart ?? ""}
              onMouseEnter={updateSelectedPoint}
              onMouseMove={updateSelectedPoint}
              onMouseLeave={updateSelectedPoint}
              margin={{ bottom: 0, left: 0, top: 3, right: 0 }}
            >
              <Tooltip content={() => <></>} />
              <Line
                type="monotone"
                dataKey="score"
                dot={false}
                className={styles.score ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "final" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="uptimeScore"
                dot={false}
                className={styles.uptimeScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "uptime" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="deviationScore"
                dot={false}
                className={styles.deviationScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "deviation" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="stalledScore"
                dot={false}
                className={styles.stalledScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "stalled" ? 3 : 1}
              />
              <XAxis dataKey="time" hide />
              <YAxis hide />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
      <h3 className={styles.date}>
        Score details for{" "}
        {currentPoint && dateFormatter.format(currentPoint.time)}
      </h3>
      <ul className={styles.smallLegend}>
        <li>
          <Metric
            component="uptime"
            name={SCORE_COMPONENT_TO_LABEL.uptime}
            description="Percentage of time a publisher is available and active"
          />
          <dl>
            <div className={styles.weight}>
              <dt>Weight</dt>
              <dd>40%</dd>
            </div>
            <div className={styles.scoreValue}>
              <dt>Score</dt>
              <dd>{numberFormatter.format(currentPoint?.uptimeScore ?? 0)}</dd>
            </div>
          </dl>
        </li>
        <li>
          <Metric
            component="deviation"
            name={SCORE_COMPONENT_TO_LABEL.deviation}
            description="Deviations that occur between a publishers' price and the aggregate price"
          />
          <dl>
            <div className={styles.weight}>
              <dt>Weight</dt>
              <dd>40%</dd>
            </div>
            <div className={styles.scoreValue}>
              <dt>Score</dt>
              <dd>
                {numberFormatter.format(currentPoint?.deviationScore ?? 0)}
              </dd>
            </div>
          </dl>
        </li>
        <li>
          <Metric
            component="stalled"
            name={SCORE_COMPONENT_TO_LABEL.stalled}
            description="Penalizes publishers reporting the same value for the price"
          />
          <dl>
            <div className={styles.weight}>
              <dt>Weight</dt>
              <dd>20%</dd>
            </div>
            <div className={styles.scoreValue}>
              <dt>Score</dt>
              <dd>{numberFormatter.format(currentPoint?.stalledScore ?? 0)}</dd>
            </div>
          </dl>
        </li>
        <li>
          <Metric
            component="final"
            name={SCORE_COMPONENT_TO_LABEL.final}
            description="The aggregate score, calculated by combining the other three score components"
          />
          <dl>
            <div className={styles.weight}></div>
            <div className={styles.scoreValue}>
              <dt>Score</dt>
              <dd>{numberFormatter.format(currentPoint?.score ?? 0)}</dd>
            </div>
          </dl>
        </li>
      </ul>
      <Table
        label="Score Breakdown"
        rounded
        fill
        className={styles.legendTable ?? ""}
        columns={[
          {
            id: "metric",
            name: "METRIC",
            isRowHeader: true,
            alignment: "left",
          },
          {
            id: "weight",
            name: "WEIGHT",
            alignment: "right",
            width: 10,
            className: styles.scoreCell ?? "",
          },
          {
            id: "score",
            name: "SCORE",
            alignment: "right",
            width: 14,
            className: styles.scoreCell ?? "",
          },
        ]}
        rows={[
          {
            id: "uptime",
            onHoverStart: hoverUptime,
            onHoverEnd: clearHover,
            onAction: toggleFocusUptime,
            data: {
              metric: (
                <Metric
                  component="uptime"
                  name={SCORE_COMPONENT_TO_LABEL.uptime}
                  description="Percentage of time a publisher is available and active"
                />
              ),
              weight: "40%",
              score: numberFormatter.format(currentPoint?.uptimeScore ?? 0),
            },
          },
          {
            id: "deviation",
            onHoverStart: hoverDeviation,
            onHoverEnd: clearHover,
            onAction: toggleFocusDeviation,
            data: {
              metric: (
                <Metric
                  component="deviation"
                  name={SCORE_COMPONENT_TO_LABEL.deviation}
                  description="Deviations that occur between a publishers' price and the aggregate price"
                />
              ),
              weight: "40%",
              score: numberFormatter.format(currentPoint?.deviationScore ?? 0),
            },
          },
          {
            id: "staleness",
            onHoverStart: hoverStalled,
            onHoverEnd: clearHover,
            onAction: toggleFocusStalled,
            data: {
              metric: (
                <Metric
                  component="stalled"
                  name={SCORE_COMPONENT_TO_LABEL.stalled}
                  description="Penalizes publishers reporting the same value for the price"
                />
              ),
              weight: "20%",
              score: numberFormatter.format(currentPoint?.stalledScore ?? 0),
            },
          },
          {
            id: "final",
            onHoverStart: hoverFinal,
            onHoverEnd: clearHover,
            onAction: toggleFocusFinal,
            data: {
              metric: (
                <Metric
                  component="final"
                  name={SCORE_COMPONENT_TO_LABEL.final}
                  description="The aggregate score, calculated by combining the other three score components"
                />
              ),
              weight: undefined,
              score: numberFormatter.format(currentPoint?.score ?? 0),
            },
          },
        ]}
      />
    </>
  );
};

type ScoreComponent = "uptime" | "deviation" | "stalled" | "final";

const SCORE_COMPONENT_TO_LABEL = {
  uptime: "Uptime Score",
  deviation: "Deviation Score",
  stalled: "Stalled Score",
  final: "Final Score",
} as const;

const MainChartLabel = ({
  component,
}: {
  component: ScoreComponent | undefined;
}) => `${component ? SCORE_COMPONENT_TO_LABEL[component] : "Score"} History`;

type MetricProps = {
  name: ReactNode;
  description: string;
  component: string;
};

const Metric = ({ name, description, component }: MetricProps) => (
  <div className={styles.metric} data-component={component}>
    <div className={styles.metricName}>
      <svg viewBox="0 0 12 12" className={styles.legend}>
        <circle cx="6" cy="6" r="4" strokeWidth="2" />
      </svg>
      {name}
    </div>
    <div className={styles.metricDescription}>{description}</div>
  </div>
);
