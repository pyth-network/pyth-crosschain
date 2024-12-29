"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";
import dynamic from "next/dynamic";
import { Suspense, useState, useCallback, useMemo } from "react";
import { useDateFormatter, useNumberFormatter } from "react-aria";
import { ResponsiveContainer, Tooltip, Line, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";

import styles from "./median-score-history.module.scss";
import { Score } from "../Score";

const LineChart = dynamic(
  () => import("recharts").then((recharts) => recharts.LineChart),
  {
    ssr: false,
  },
);

const CHART_HEIGHT = 104;

type Props = {
  medianScoreHistory: Point[];
};

type Point = {
  time: Date;
  medianScore: number;
  medianUptimeScore: number;
  medianDeviationScore: number;
  medianStalledScore: number;
};

export const MedianScoreHistory = ({ medianScoreHistory }: Props) => {
  const [selectedPoint, setSelectedPoint] = useState<
    (typeof medianScoreHistory)[number] | undefined
  >(undefined);
  const updateSelectedPoint = useCallback(
    (chart: CategoricalChartState) => {
      setSelectedPoint(
        (chart.activePayload as { payload: Point }[] | undefined)?.[0]?.payload,
      );
    },
    [setSelectedPoint],
  );
  const currentPoint = useMemo(
    () => selectedPoint ?? medianScoreHistory.at(-1),
    [selectedPoint, medianScoreHistory],
  );
  const dateFormatter = useDateFormatter();
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 4 });

  const [hoveredScore, setHoveredScore] = useState<FocusedScore>(undefined);
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

  const [focusedScore, setFocusedScore] = useState<FocusedScore>(undefined);
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
    <div className={styles.medianScoreHistory}>
      <div
        className={styles.medianScoreHistoryChart}
        data-hovered-score={hoveredScore}
        data-focused-score={focusedScore}
      >
        <div className={styles.top}>
          <div className={styles.left}>
            <h3 className={styles.header}>
              <HeaderText
                hoveredScore={hoveredScore}
                focusedScore={focusedScore}
              />
            </h3>
            <div className={styles.subheader}>
              {selectedPoint
                ? dateFormatter.format(selectedPoint.time)
                : "Last 30 days"}
            </div>
          </div>
          {currentPoint && (
            <CurrentValue point={currentPoint} focusedScore={focusedScore} />
          )}
        </div>
        <Suspense
          fallback={<div style={{ height: `${CHART_HEIGHT.toString()}px` }} />}
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart
              data={medianScoreHistory}
              className={styles.chart ?? ""}
              onMouseEnter={updateSelectedPoint}
              onMouseMove={updateSelectedPoint}
              onMouseLeave={updateSelectedPoint}
              margin={{ bottom: 0, left: 0, top: 0, right: 0 }}
            >
              <Tooltip content={() => <></>} />
              <Line
                type="monotone"
                dataKey="medianScore"
                dot={false}
                className={styles.medianScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "final" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="medianUptimeScore"
                dot={false}
                className={styles.medianUptimeScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "uptime" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="medianDeviationScore"
                dot={false}
                className={styles.medianDeviationScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "deviation" ? 3 : 1}
              />
              <Line
                type="monotone"
                dataKey="medianStalledScore"
                dot={false}
                className={styles.medianStalledScore ?? ""}
                stroke="currentColor"
                strokeWidth={focusedScore === "stalled" ? 3 : 1}
              />
              <XAxis dataKey="time" hide />
              <YAxis hide />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
      <Card
        title="Score Breakdown"
        nonInteractive
        className={styles.rankingBreakdown}
      >
        <Table
          label="Score Breakdown"
          rounded
          fill
          columns={[
            {
              id: "legend",
              name: "",
              width: 4,
              className: styles.legendCell ?? "",
            },
            {
              id: "metric",
              name: "METRIC",
              isRowHeader: true,
              alignment: "left",
            },
            {
              id: "score",
              name: "SCORE",
              alignment: "right",
              width: 23,
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
                legend: <div className={styles.uptimeLegend} />,
                metric: (
                  <Metric
                    name="Median Uptime"
                    description="Percentage of time a publisher is available and active"
                  />
                ),
                score: numberFormatter.format(
                  currentPoint?.medianUptimeScore ?? 0,
                ),
              },
            },
            {
              id: "deviation",
              onHoverStart: hoverDeviation,
              onHoverEnd: clearHover,
              onAction: toggleFocusDeviation,
              data: {
                legend: <div className={styles.deviationLegend} />,
                metric: (
                  <Metric
                    name="Median Price Deviation"
                    description="Deviations that occur between a publishers' price and the aggregate price"
                  />
                ),
                score: numberFormatter.format(
                  currentPoint?.medianDeviationScore ?? 0,
                ),
              },
            },
            {
              id: "staleness",
              onHoverStart: hoverStalled,
              onHoverEnd: clearHover,
              onAction: toggleFocusStalled,
              data: {
                legend: <div className={styles.stalledLegend} />,
                metric: (
                  <Metric
                    name="Median Staleness"
                    description="Penalizes publishers reporting the same value for the price"
                  />
                ),
                score: numberFormatter.format(
                  currentPoint?.medianStalledScore ?? 0,
                ),
              },
            },
            {
              id: "final",
              onHoverStart: hoverFinal,
              onHoverEnd: clearHover,
              onAction: toggleFocusFinal,
              data: {
                legend: <div className={styles.finalScoreLegend} />,
                metric: (
                  <Metric
                    name="Median Final Score"
                    description="The aggregate score, calculated by combining the other three score components"
                  />
                ),
                score: numberFormatter.format(currentPoint?.medianScore ?? 0),
              },
            },
          ]}
        />
      </Card>
    </div>
  );
};

type HeaderTextProps = {
  focusedScore: FocusedScore;
  hoveredScore: FocusedScore;
};

const HeaderText = ({ hoveredScore, focusedScore }: HeaderTextProps) => {
  switch (focusedScore ?? hoveredScore) {
    case "uptime": {
      return "Median Uptime Score History";
    }
    case "deviation": {
      return "Median Deviation Score History";
    }
    case "stalled": {
      return "Median Stalled Score History";
    }
    default: {
      return "Median Score History";
    }
  }
};

type FocusedScore = "uptime" | "deviation" | "stalled" | "final" | undefined;

type CurrentValueProps = {
  point: Point;
  focusedScore: FocusedScore;
};

const CurrentValue = ({ point, focusedScore }: CurrentValueProps) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 4 });
  switch (focusedScore) {
    case "uptime": {
      return numberFormatter.format(point.medianUptimeScore);
    }
    case "deviation": {
      return numberFormatter.format(point.medianDeviationScore);
    }
    case "stalled": {
      return numberFormatter.format(point.medianStalledScore);
    }
    default: {
      return <Score score={point.medianScore} />;
    }
  }
};

type MetricProps = {
  name: string;
  description: string;
};

const Metric = ({ name, description }: MetricProps) => (
  <div className={styles.metric}>
    <div className={styles.metricName}>{name}</div>
    <div className={styles.metricDescription}>{description}</div>
  </div>
);
