import type React from "react";

import styles from "./index.module.scss";

export type Props = {
  text: string;
  minCharsStart?: number | undefined;
  minCharsEnd?: number | undefined;
};

const TruncateToMiddle = ({
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
        className={styles.truncateToMiddle}
        style={style}
        data-text-start={text.slice(0, Math.floor(text.length / 2))}
        data-text-end={text.slice(Math.floor(text.length / 2) * -1)}
        aria-hidden="true"
      />
      <span className={styles.srOnly}>{text}</span>
    </>
  );
};

export default TruncateToMiddle;
