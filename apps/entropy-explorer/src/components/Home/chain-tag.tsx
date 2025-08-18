import clsx from "clsx";
import Image from "next/image";
import type { ComponentProps } from "react";

import styles from "./chain-tag.module.scss";
import type { EntropyDeployment } from "../../entropy-deployments";

export const ChainTag = ({
  chain,
  className,
  ...props
}: { chain: EntropyDeployment } & ComponentProps<"div">) => (
  <div className={clsx(styles.chainTag, className)} {...props}>
    <Image alt="" src={chain.icon} width={20} height={20} />
    {chain.name}
  </div>
);
