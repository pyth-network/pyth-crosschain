import { Card } from "@pythnetwork/component-library/Card";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import cx from "clsx";
import type { PropsWithChildren, Ref } from "react";

import styles from "./index.module.scss";
import { PriceFeedIcon } from "../PriceFeedIcon";

type PriceCardProps = PropsWithChildren & {
  /**
   * if specified, will display a different
   * icon to denote the asset.
   * otherwise, a default icon will be used.
   */
  assetClass?: string;

  /**
   * css class name override
   */
  className?: string;

  /**
   * additional description or useful
   * content to be displayed underneath
   * the displaySymbol name
   */
  description?: string;

  /**
   * human-friendly shortname for the symbol
   * being visualized
   */
  displaySymbol: string;

  /**
   * if provided, will be passed to the underlying <Card />,
   * which will turn it into a clickable hyperlink
   */
  href?: string;

  /**
   * ref handle
   */
  ref?: Ref<HTMLDivElement>;
};

export function PriceCard({
  assetClass,
  children,
  className,
  description,
  displaySymbol,
  href,
  ref,
}: PriceCardProps) {
  return (
    <Card href={href} ref={ref} variant="tertiary">
      <div className={cx(styles.feedCardContents, className)}>
        <SymbolPairTag
          displaySymbol={displaySymbol}
          description={description ?? ""}
          icon={<PriceFeedIcon assetClass={assetClass ?? ""} />}
        />
        {children && <div className={styles.prices}>{children}</div>}
      </div>
    </Card>
  );
}
