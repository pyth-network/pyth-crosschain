import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { Button } from "@pythnetwork/component-library/unstyled/Button";
import { useState } from "react";
import TimeAgo from "react-timeago";

import styles from "./index.module.scss";

export const Timestamp = ({ timestamp }: { timestamp: Date }) => {
  const [showRelative, setShowRelative] = useState(true);
  const month = timestamp.toLocaleString("default", {
    month: "long",
    timeZone: "UTC",
  });
  const day = timestamp.getUTCDate();
  const year = timestamp.getUTCFullYear();
  const hour = timestamp.getUTCHours().toString().padStart(2, "0");
  const minute = timestamp.getUTCMinutes().toString().padStart(2, "0");
  const seconds = timestamp.getUTCSeconds().toString().padStart(2, "0");
  return (
    <Button
      onPress={() => {
        setShowRelative((cur) => !cur);
      }}
      className={styles.timestamp ?? ""}
      data-show-relative={showRelative ? "" : undefined}
    >
      <Clock className={styles.clock} />
      <span className={styles.relative}>
        <TimeAgo date={timestamp} />
      </span>
      <span className={styles.absolute}>
        {month}-{day}-{year} {hour}:{minute}:{seconds} +UTC
      </span>
    </Button>
  );
};
