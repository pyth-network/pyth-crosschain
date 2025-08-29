"use client";

import { Download } from "@phosphor-icons/react/dist/ssr/Download";
import { Button } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";
import { useAlert } from "@pythnetwork/component-library/useAlert";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useCallback, useState } from "react";

import styles from "./conformance-report.module.scss";
import type { Interval } from "./types";
import { INTERVALS } from "./types";

type ConformanceReportProps = {
  onClick: (timeframe: Interval) => Promise<void>;
};

const ConformanceReport = (props: ConformanceReportProps) => {
  const [timeframe, setTimeframe] = useState<Interval>(INTERVALS[0]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { open } = useAlert();
  const logger = useLogger();

  /**
   * Download the conformance report for the given symbol or publisher
   */
  const downloadReport = useCallback(async () => {
    await props.onClick(timeframe);
  }, [props, timeframe]);

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
