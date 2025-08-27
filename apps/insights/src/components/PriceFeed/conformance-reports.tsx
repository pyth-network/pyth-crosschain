"use client";

import { Download } from "@phosphor-icons/react/dist/ssr/Download";
import { Button } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useAlert } from "@pythnetwork/component-library/useAlert";
import { useState } from "react";

import styles from "./conformance-reports.module.scss";

const PYTHTEST_CONFORMANCE_REFERENCE_PUBLISHER =
  "HUZu4xMSHbxTWbkXR6jkGdjvDPJLjrpSNXSoUFBRgjWs";

const download = (blob: Blob, filename: string) => {
  const url = globalThis.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
};

type ConformanceReportsProps =
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      symbol: string;
      cluster: string;
      publisher: string;
    };

const ConformanceReports = (props: ConformanceReportsProps) => {
  const [timeframe, setTimeframe] = useState("24H");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { open } = useAlert();

  const downloadReport = async () => {
    if (props.isLoading) {
      return;
    }
    const url = new URL(
      "/pyth/metrics/conformance",
      "https://web-api.pyth.network/",
    );
    url.searchParams.set("symbol", props.symbol);
    url.searchParams.set("range", timeframe);
    url.searchParams.set("cluster", "pythnet");
    url.searchParams.set("publisher", props.publisher);

    if (props.cluster === "pythtest-conformance") {
      url.searchParams.set(
        "pythnet_aggregate_publisher",
        PYTHTEST_CONFORMANCE_REFERENCE_PUBLISHER,
      );
    }

    const response = await fetch(url, {
      headers: new Headers({
        Accept: "application/octet-stream",
      }),
    });
    const blob = await response.blob();
    download(
      blob,
      `${props.publisher}-${props.symbol
        .split("/")
        .join("")}-${timeframe}-${props.cluster}-conformance-report.tsv`,
    );
  };

  const handleReport = () => {
    setIsGeneratingReport(true);
    try {
      downloadReport().catch(() => {
        open({
          title: "Error",
          contents: "Error generating conformance report",
        });
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };
  if (props.isLoading) {
    return <Skeleton width={100} />;
  }
  return (
    <div className={styles.conformanceReports}>
      <Select
        options={[
          { id: "24H" },
          { id: "48H" },
          { id: "72H" },
          { id: "1W" },
          { id: "1M" },
        ]}
        placement="bottom end"
        selectedKey={timeframe}
        onSelectionChange={(value) => {
          setTimeframe(value);
        }}
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

export default ConformanceReports;
