"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";
import dynamic from "next/dynamic";
import {
  type ReactNode,
  Suspense,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useDateFormatter, useNumberFormatter } from "react-aria";
import { ResponsiveContainer, Tooltip, Line, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";

import styles from "./index.module.scss";
import { Score } from "../Score";

const LineChart = dynamic(
  () => import("recharts").then((recharts) => recharts.LineChart),
  {
    ssr: false,
  },
);

const CHART_HEIGHT = 104;

type Props = {
  isMedian?: boolean | undefined;
  scoreHistory: Point[];
};

type Point = {
  time: Date;
  score: number;
  uptimeScore: number;
  deviationScore: number;
  stalledScore: number;
};

export const ScoreHistory = ({ isMedian, scoreHistory }: Props) => {
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
  const dateFormatter = useDateFormatter();
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 4 });

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
    <div className={styles.scoreHistory}>
      <div
        className={styles.scoreHistoryChart}
        data-hovered-score={hoveredScore}
        data-focused-score={focusedScore}
      >
        <div className={styles.top}>
          <div className={styles.left}>
            <h3 className={styles.header}>
              <Label
                isMedian={isMedian}
                component={hoveredScore ?? focusedScore ?? "final"}
              />{" "}
              History
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
                    name={<Label isMedian={isMedian} component="uptime" />}
                    description="Percentage of time a publisher is available and active"
                  />
                ),
                score: numberFormatter.format(currentPoint?.uptimeScore ?? 0),
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
                    name={<Label isMedian={isMedian} component="deviation" />}
                    description="Deviations that occur between a publishers' price and the aggregate price"
                  />
                ),
                score: numberFormatter.format(
                  currentPoint?.deviationScore ?? 0,
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
                    name={<Label isMedian={isMedian} component="stalled" />}
                    description="Penalizes publishers reporting the same value for the price"
                  />
                ),
                score: numberFormatter.format(currentPoint?.stalledScore ?? 0),
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
                    name={<Label isMedian={isMedian} component="final" />}
                    description="The aggregate score, calculated by combining the other three score components"
                  />
                ),
                score: numberFormatter.format(currentPoint?.score ?? 0),
              },
            },
          ]}
        />
      </Card>
    </div>
  );
};

type HeaderTextProps = {
  isMedian?: boolean | undefined;
  component: ScoreComponent;
};

const Label = ({ isMedian, component }: HeaderTextProps) => {
  switch (component) {
    case "uptime": {
      return `${isMedian ? "Median " : ""}Uptime Score`;
    }
    case "deviation": {
      return `${isMedian ? "Median " : ""}Deviation Score`;
    }
    case "stalled": {
      return `${isMedian ? "Median " : ""}Stalled Score`;
    }
    case "final": {
      return `${isMedian ? "Median " : ""}Final Score`;
    }
  }
};

type ScoreComponent = "uptime" | "deviation" | "stalled" | "final";

type CurrentValueProps = {
  point: Point;
  focusedScore: ScoreComponent | undefined;
};

const CurrentValue = ({ point, focusedScore }: CurrentValueProps) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 4 });
  switch (focusedScore) {
    case "uptime": {
      return numberFormatter.format(point.uptimeScore);
    }
    case "deviation": {
      return numberFormatter.format(point.deviationScore);
    }
    case "stalled": {
      return numberFormatter.format(point.stalledScore);
    }
    default: {
      return <Score score={point.score} />;
    }
  }
};

type MetricProps = {
  name: ReactNode;
  description: string;
};

const Metric = ({ name, description }: MetricProps) => (
  <div className={styles.metric}>
    <div className={styles.metricName}>{name}</div>
    <div className={styles.metricDescription}>{description}</div>
  </div>
);
