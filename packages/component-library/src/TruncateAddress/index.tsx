import React, { useMemo } from "react";

import styles from "./index.module.scss";

export type Props = {
  text: string;
  fixed?: boolean;
  minCharsStart?: number | undefined;
  minCharsEnd?: number | undefined;
};

export const TruncateAddress = ({ fixed = false, ...rest }: Props) => {
  return fixed ? (
    <TruncateAddressFixed {...rest} />
  ) : (
    <TruncateAddressDynamic {...rest} />
  );
};

const TruncateAddressDynamic = ({
  text,
  minCharsStart = 0,
  minCharsEnd = 0,
}: Props) => {
  // We're setting a minimum width using CSS 'ch' units, which are relative to the
  // width of the '0' character. This provides a good approximation for showing
  // a certain number of characters. However, since character widths vary
  // (e.g., 'i' is narrower than 'W'), the exact count of visible characters
  // might differ slightly from the specified 'ch' value.
  const style = {
    "--min-chars-start-ch": `${minCharsStart.toString()}ch`,
    "--min-chars-end-ch": `${minCharsEnd.toString()}ch`,
  } as React.CSSProperties;

  return (
    <>
      <span
        className={styles.truncateAddressDynamic}
        style={style}
        data-text-start={text.slice(0, Math.floor(text.length / 2))}
        data-text-end={text.slice(Math.floor(text.length / 2) * -1)}
        aria-hidden="true"
      />
      <span className={styles.srOnly}>{text}</span>
    </>
  );
};

const TruncateAddressFixed = ({
  text,
  minCharsStart = 6,
  minCharsEnd = 6,
}: Props) => {
  const truncatedValue = useMemo(
    () =>
      text.length <= minCharsStart + minCharsEnd
        ? text
        : `${text.slice(0, minCharsStart)}…${text.slice(minCharsEnd * -1)}`,
    [text, minCharsStart, minCharsEnd],
  );

  return truncatedValue === text ? (
    <span>{text}</span>
  ) : (
    <>
      <span aria-hidden="true">{truncatedValue}</span>
      <span className={styles.srOnly}>{text}</span>
    </>
  );
};
