import { useCallback } from "react";

import { WEB_API_BASE_URL } from "./constants";
import type { Interval } from "./types";
import { useDownloadBlob } from "../../hooks/use-download-blob";
import { CLUSTER_NAMES } from "../../services/pyth";

const PYTHTEST_CONFORMANCE_REFERENCE_PUBLISHER =
  "HUZu4xMSHbxTWbkXR6jkGdjvDPJLjrpSNXSoUFBRgjWs";

export const useDownloadReportForFeed = () => {
  const download = useDownloadBlob();

  return useCallback(
    async ({
      symbol,
      publisher,
      timeframe,
      cluster,
    }: {
      symbol: string;
      publisher: string;
      timeframe: Interval;
      cluster: (typeof CLUSTER_NAMES)[number];
    }) => {
      const url = new URL("/metrics/conformance", WEB_API_BASE_URL);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("range", timeframe);
      url.searchParams.set("cluster", cluster);
      url.searchParams.set("publisher", publisher);

      if (cluster === "pythtest-conformance") {
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
        `${publisher}-${symbol
          .split("/")
          .join("")}-${timeframe}-${cluster}-conformance-report.tsv`,
      );
    },
    [download],
  );
};
