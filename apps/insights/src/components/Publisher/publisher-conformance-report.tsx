"use client";

import { useCallback } from "react";

import { CLUSTER_NAMES } from "../../services/pyth";
import ConformanceReport from "../ConformanceReport/conformance-report";
import type { Interval } from "../ConformanceReport/types";
import { useDownloadReportForPublisher } from "../ConformanceReport/use-download-report-for-publisher";

export const PublisherConformanceReport = ({
  publisherKey,
  cluster,
}: {
  publisherKey: string;
  cluster: (typeof CLUSTER_NAMES)[number];
}) => {
  const downloadReportForPublisher = useDownloadReportForPublisher();
  const handleDownloadReport = useCallback(
    (interval: Interval) => {
      return downloadReportForPublisher({
        publisher: publisherKey,
        cluster,
        interval,
      });
    },
    [publisherKey, cluster, downloadReportForPublisher],
  );

  return <ConformanceReport onClick={handleDownloadReport} />;
};
