"use client";

import { Download } from "@phosphor-icons/react/dist/ssr/Download";
import { Button } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useAlert } from "@pythnetwork/component-library/useAlert";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useState } from "react";

import styles from "./conformance-report.module.scss";
import type { Interval } from "./types";
import { INTERVALS } from "./types";
import { useDownloadReportForFeed } from "./use-download-report-for-feed";
import { useDownloadReportForPublisher } from "./use-download-report-for-publisher";
import { CLUSTER_NAMES } from "../../services/pyth";

type ConformanceReportProps =
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      symbol?: string;
      cluster: (typeof CLUSTER_NAMES)[number];
      publisher?: string;
    };

const ConformanceReport = (props: ConformanceReportProps) => {
  const [timeframe, setTimeframe] = useState<Interval>(INTERVALS[0]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { open } = useAlert();
  const downloadReportForFeed = useDownloadReportForFeed();
  const downloadReportForPublisher = useDownloadReportForPublisher();
  const logger = useLogger();

  /**
   * Download the conformance report for the given symbol or publisher
   */
  const downloadReport = async () => {
    if (props.isLoading) {
      return;
    }
    if (props.symbol && props.publisher) {
      await downloadReportForFeed({
        symbol: props.symbol,
        publisher: props.publisher,
        timeframe,
        cluster: props.cluster,
      });
    }

    if (props.publisher) {
      await downloadReportForPublisher({
        publisher: props.publisher,
        cluster: props.cluster,
        interval: timeframe,
      });
    }
  };

  const handleReport = () => {
    setIsGeneratingReport(true);
    downloadReport()
      .catch((error: unknown) => {
        open({
          title: "Error",
          contents: "Error generating conformance report",
        });
        logger.error(error);
      })
      .finally(() => {
        setIsGeneratingReport(false);
      });
  };

  if (props.isLoading) {
    return <Skeleton width={100} />;
  }

  return (
    <div className={styles.conformanceReport}>
      <Select
        options={INTERVALS.map((interval) => ({ id: interval }))}
        placement="bottom end"
        selectedKey={timeframe}
        onSelectionChange={setTimeframe}
        size="sm"
        label="Timeframe"
        variant="outline"
        hideLabel
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleReport}
        afterIcon={<Download key="download" />}
        isPending={isGeneratingReport}
      >
        Report
      </Button>
    </div>
  );
};

export default ConformanceReport;
