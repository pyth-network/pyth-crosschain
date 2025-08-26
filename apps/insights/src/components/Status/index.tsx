import type { PriceData } from "@pythnetwork/client";
import { Status as StatusComponent } from "@pythnetwork/component-library/Status";
import { useMemo } from "react";

import { useLivePriceData } from "../../hooks/use-live-price-data";
import type { Cluster } from "../../services/pyth";
import { Status as StatusType } from "../../status";

export const Status = ({ status }: { status: StatusType }) => (
  <StatusComponent variant={getVariant(status)}>
    {getText(status)}
  </StatusComponent>
);

export const StatusLive = ({
  cluster,
  feedKey,
  publisherKey,
}: {
  cluster: Cluster;
  feedKey: string;
  publisherKey: string;
}) => {
  const status = useGetStatus(cluster, feedKey, publisherKey);

  return <Status status={status} />;
};

const useGetStatus = (
  cluster: Cluster,
  feedKey: string,
  publisherKey: string,
) => {
  const data = useLivePriceData(cluster, feedKey);
  return useMemo(() => {
    return getStatus(data.current, publisherKey);
  }, [data.current, feedKey, publisherKey]);
};

export const getStatus = (
  currentPriceData: PriceData | undefined,
  publisherKey: string,
) => {
  if (!currentPriceData) {
    return StatusType.Unknown;
  }
  const lastPublishedSlot = currentPriceData.priceComponents.find(
    (price) => price.publisher.toString() === publisherKey,
  )?.latest.publishSlot;
  const isPublisherInactive =
    Number(lastPublishedSlot ?? 0) < Number(currentPriceData.validSlot) - 100;

  return isPublisherInactive ? StatusType.Down : StatusType.Live;
};

const getVariant = (status: StatusType) => {
  switch (status) {
    case StatusType.Live: {
      return "success";
    }
    case StatusType.Down: {
      return "error";
    }
    case StatusType.Unknown: {
      return "disabled";
    }
  }
};

const getText = (status: StatusType) => {
  switch (status) {
    case StatusType.Live: {
      return "Live";
    }
    case StatusType.Down: {
      return "Down";
    }
    case StatusType.Unknown: {
      return "Unknown";
    }
  }
};
