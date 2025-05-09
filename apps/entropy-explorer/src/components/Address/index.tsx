import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Link } from "@pythnetwork/component-library/Link";
import { useMemo } from "react";

import styles from "./index.module.scss";
import { EntropyDeployments } from "../../entropy-deployments";
import { truncate } from "../../truncate";

type Props = {
  value: string;
  chain: keyof typeof EntropyDeployments;
  alwaysTruncate?: boolean | undefined;
};

export const Address = ({ value, chain, alwaysTruncate }: Props) => {
  const { explorer } = EntropyDeployments[chain];
  const truncatedValue = useMemo(() => truncate(value), [value]);
  return (
    <div
      data-always-truncate={alwaysTruncate ? "" : undefined}
      className={styles.address}
    >
      <Link
        href={explorer.replace("$ADDRESS", value)}
        target="_blank"
        rel="noreferrer"
      >
        <code className={styles.truncated}>{truncatedValue}</code>
        <code className={styles.full}>{value}</code>
      </Link>
      <CopyButton text={value} iconOnly />
    </div>
  );
};
