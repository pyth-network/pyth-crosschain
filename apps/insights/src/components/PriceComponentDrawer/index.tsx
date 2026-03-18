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
import { parseAsString, useQueryState } from "@pythnetwork/react-hooks/nuqs";
import { useMountEffect } from "@react-hookz/web";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  RouterProvider,
  useDateFormatter,
  useNumberFormatter,
} from "react-aria";
import { Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";
import { z } from "zod";

import { Cluster, ClusterToName } from "../../services/pyth";
import type { Status } from "../../status";
import ConformanceReport from "../ConformanceReport/conformance-report";
import type { Interval } from "../ConformanceReport/types";
import { useDownloadReportForFeed } from "../ConformanceReport/use-download-report-for-feed";
import { LiveComponentValue, LiveConfidence, LivePrice } from "../LivePrices";
import { PriceName } from "../PriceName";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";
import styles from "./index.module.scss";

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
    [router, logger, drawer],
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
        bodyClassName: styles.priceComponentDrawerBody ?? "",
        className: styles.priceComponentDrawer ?? "",
        contents: (
          <RouterProvider navigate={navigate}>
            {component.cluster === Cluster.PythtestConformance && (
              <InfoBox
                className={styles.testFeedMessage}
                header={`This publisher is in test`}
                icon={<Flask />}
              >
                This is a test publisher. Its prices are not included in the
                Pyth aggregate price for {component.displaySymbol}.
              </InfoBox>
            )}
            <div className={styles.stats}>
              <StatCard
                header={
                  <>
                    Aggregated <PriceName assetClass={component.assetClass} />
                  </>
                }
                nonInteractive
                small
                stat={
                  <LivePrice
                    cluster={component.cluster}
                    feedKey={component.feedKey}
                  />
                }
              />
              <StatCard
                header={
                  <>
                    Publisher <PriceName assetClass={component.assetClass} />
                  </>
                }
                nonInteractive
                small
                stat={
                  <LivePrice
                    cluster={component.cluster}
                    feedKey={component.feedKey}
                    publisherKey={component.publisherKey}
                  />
                }
                variant="primary"
              />
              <StatCard
                header="Publisher Confidence"
                nonInteractive
                small
                stat={
                  <LiveConfidence
                    cluster={component.cluster}
                    feedKey={component.feedKey}
                    publisherKey={component.publisherKey}
                  />
                }
              />
              <StatCard
                header="Last Slot"
                nonInteractive
                small
                stat={
                  <LiveComponentValue
                    cluster={component.cluster}
                    feedKey={component.feedKey}
                    field="publishSlot"
                    publisherKey={component.publisherKey}
                  />
                }
              />
              <StatCard
                header="Score"
                nonInteractive
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
                header="Quality Rank"
                nonInteractive
                small
                stat={component.rank ?? <></>}
              />
            </div>
            {component.firstEvaluation && (
              <ScoreBreakdown
                cluster={component.cluster}
                firstEvaluation={component.firstEvaluation}
                publisherKey={component.publisherKey}
                symbol={component.symbol}
              />
            )}
          </RouterProvider>
        ),
        headingAfter: (
          <div className={styles.badges}>
            <StatusComponent status={component.status} />
          </div>
        ),
        headingExtra: (
          <RouterProvider navigate={navigate}>
            <HeadingExtra
              cluster={component.cluster}
              identifiesPublisher={identifiesPublisher}
              publisherKey={component.publisherKey}
              status={component.status}
              symbol={component.symbol}
            />
          </RouterProvider>
        ),
        onClose: clearSelectedComponent,
        title: component.name,
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
  const downloadReportForFeed = useDownloadReportForFeed();

  const handleDownloadReport = useCallback(
    (timeframe: Interval) => {
      return downloadReportForFeed({
        cluster: ClusterToName[props.cluster],
        publisher: props.publisherKey,
        symbol: props.symbol,
        timeframe,
      });
    },
    [downloadReportForFeed, props.cluster, props.publisherKey, props.symbol],
  );

  return (
    <>
      <ConformanceReport onClick={handleDownloadReport} />
      <div className={styles.bigScreenBadges}>
        <StatusComponent status={status} />
      </div>
      <OpenButton
        beforeIcon={<ArrowSquareOut />}
        className={styles.ghostOpenButton ?? ""}
        hideText
        rounded
        variant="ghost"
        {...props}
      />
      <OpenButton
        className={styles.outlineOpenButton ?? ""}
        variant="outline"
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
    <Button href={href} size="sm" {...props}>
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
      className={styles.rankingBreakdown}
      nonInteractive
      title="Score Breakdown"
      toolbar={
        <Select
          hideLabel
          label="Evaluation Period"
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
          selectedKey={selectedPeriod.label}
          size="sm"
          variant="outline"
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
        end,
        label: `${dateFormatter.format(start)} to ${end < today ? dateFormatter.format(end) : "Now"}`,
        start,
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

  return { evaluationPeriods, selectedPeriod, setSelectedPeriod };
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
          className={styles.spinner ?? ""}
          isIndeterminate
          label="Loading score history"
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
    deviationScore: z.number(),
    score: z.number(),
    stalledScore: z.number(),
    time: z.string().transform((value) => new Date(value)),
    uptimeScore: z.number(),
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
  const updateSelectedPoint = useCallback((chart: CategoricalChartState) => {
    setSelectedPoint(
      (chart.activePayload as { payload: Point }[] | undefined)?.[0]?.payload,
    );
  }, []);
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
  }, []);
  const hoverDeviation = useCallback(() => {
    setHoveredScore("deviation");
  }, []);
  const hoverStalled = useCallback(() => {
    setHoveredScore("stalled");
  }, []);
  const hoverFinal = useCallback(() => {
    setHoveredScore("final");
  }, []);
  const clearHover = useCallback(() => {
    setHoveredScore(undefined);
  }, []);

  const [focusedScore, setFocusedScore] = useState<ScoreComponent | undefined>(
    undefined,
  );
  const toggleFocusedScore = useCallback((value: typeof focusedScore) => {
    setFocusedScore((cur) => (cur === value ? undefined : value));
  }, []);
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
        data-focused-score={focusedScore}
        data-hovered-score={hoveredScore}
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
          <ResponsiveContainer height={CHART_HEIGHT} width="100%">
            <LineChart
              className={styles.chart ?? ""}
              data={scoreHistory}
              margin={{ bottom: 0, left: 0, right: 0, top: 3 }}
              onMouseEnter={updateSelectedPoint}
              onMouseLeave={updateSelectedPoint}
              onMouseMove={updateSelectedPoint}
            >
              <Tooltip content={() => <></>} />
              <Line
                className={styles.score ?? ""}
                dataKey="score"
                dot={false}
                stroke="currentColor"
                strokeWidth={focusedScore === "final" ? 3 : 1}
                type="monotone"
              />
              <Line
                className={styles.uptimeScore ?? ""}
                dataKey="uptimeScore"
                dot={false}
                stroke="currentColor"
                strokeWidth={focusedScore === "uptime" ? 3 : 1}
                type="monotone"
              />
              <Line
                className={styles.deviationScore ?? ""}
                dataKey="deviationScore"
                dot={false}
                stroke="currentColor"
                strokeWidth={focusedScore === "deviation" ? 3 : 1}
                type="monotone"
              />
              <Line
                className={styles.stalledScore ?? ""}
                dataKey="stalledScore"
                dot={false}
                stroke="currentColor"
                strokeWidth={focusedScore === "stalled" ? 3 : 1}
                type="monotone"
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
            description="Percentage of time a publisher is available and active"
            name={SCORE_COMPONENT_TO_LABEL.uptime}
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
            description="Deviations that occur between a publishers' price and the aggregate price"
            name={SCORE_COMPONENT_TO_LABEL.deviation}
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
            description="Penalizes publishers reporting the same value for the price"
            name={SCORE_COMPONENT_TO_LABEL.stalled}
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
            description="The aggregate score, calculated by combining the other three score components"
            name={SCORE_COMPONENT_TO_LABEL.final}
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
        className={styles.legendTable ?? ""}
        columns={[
          {
            alignment: "left",
            id: "metric",
            isRowHeader: true,
            name: "METRIC",
          },
          {
            alignment: "right",
            className: styles.scoreCell ?? "",
            id: "weight",
            name: "WEIGHT",
            width: 10,
          },
          {
            alignment: "right",
            className: styles.scoreCell ?? "",
            id: "score",
            name: "SCORE",
            width: 14,
          },
        ]}
        fill
        label="Score Breakdown"
        rounded
        rows={[
          {
            data: {
              metric: (
                <Metric
                  component="uptime"
                  description="Percentage of time a publisher is available and active"
                  name={SCORE_COMPONENT_TO_LABEL.uptime}
                />
              ),
              score: numberFormatter.format(currentPoint?.uptimeScore ?? 0),
              weight: "40%",
            },
            id: "uptime",
            onAction: toggleFocusUptime,
            onHoverEnd: clearHover,
            onHoverStart: hoverUptime,
          },
          {
            data: {
              metric: (
                <Metric
                  component="deviation"
                  description="Deviations that occur between a publishers' price and the aggregate price"
                  name={SCORE_COMPONENT_TO_LABEL.deviation}
                />
              ),
              score: numberFormatter.format(currentPoint?.deviationScore ?? 0),
              weight: "40%",
            },
            id: "deviation",
            onAction: toggleFocusDeviation,
            onHoverEnd: clearHover,
            onHoverStart: hoverDeviation,
          },
          {
            data: {
              metric: (
                <Metric
                  component="stalled"
                  description="Penalizes publishers reporting the same value for the price"
                  name={SCORE_COMPONENT_TO_LABEL.stalled}
                />
              ),
              score: numberFormatter.format(currentPoint?.stalledScore ?? 0),
              weight: "20%",
            },
            id: "staleness",
            onAction: toggleFocusStalled,
            onHoverEnd: clearHover,
            onHoverStart: hoverStalled,
          },
          {
            data: {
              metric: (
                <Metric
                  component="final"
                  description="The aggregate score, calculated by combining the other three score components"
                  name={SCORE_COMPONENT_TO_LABEL.final}
                />
              ),
              score: numberFormatter.format(currentPoint?.score ?? 0),
              weight: undefined,
            },
            id: "final",
            onAction: toggleFocusFinal,
            onHoverEnd: clearHover,
            onHoverStart: hoverFinal,
          },
        ]}
      />
    </>
  );
};

type ScoreComponent = "uptime" | "deviation" | "stalled" | "final";

const SCORE_COMPONENT_TO_LABEL = {
  deviation: "Deviation Score",
  final: "Final Score",
  stalled: "Stalled Score",
  uptime: "Uptime Score",
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
      <svg className={styles.legend} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="4" strokeWidth="2" />
      </svg>
      {name}
    </div>
    <div className={styles.metricDescription}>{description}</div>
  </div>
);
