import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Link } from "@pythnetwork/component-library/Link";
import { useMemo } from "react";

import styles from "./index.module.scss";
import { EntropyDeployments } from "../../entropy-deployments";
import { truncate } from "../../truncate";

type Props = {
  value: string;
  chain: keyof typeof EntropyDeployments;
  isAccount?: boolean | undefined;
};

export const Account = (props: Omit<Props, "isAccount">) => (
  <Address {...props} isAccount />
);

export const Transaction = (props: Omit<Props, "isAccount">) => (
  <Address {...props} />
);

const Address = ({ value, chain, isAccount }: Props) => {
  const { explorerTxTemplate, explorerAccountTemplate } =
    EntropyDeployments[chain];
  const explorerTemplate = isAccount
    ? explorerAccountTemplate
    : explorerTxTemplate;
  const truncatedValue = useMemo(() => truncate(value), [value]);
  return (
    <div className={styles.address}>
      <Link
        href={explorerTemplate.replace("$ADDRESS", value)}
        target="_blank"
        rel="noreferrer"
      >
        <code>{truncatedValue}</code>
      </Link>
      <CopyButton text={value} iconOnly />
    </div>
  );
};
