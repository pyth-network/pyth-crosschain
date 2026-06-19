import clsx from "clsx";

import { fmtDateShort } from "./data";
import styles from "./index.module.scss";
import type { Mode } from "./types";

const ModeToggle = ({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) => (
  <div aria-label="View mode" className={styles.modeToggle} role="tablist">
    {(["day", "stream"] as const).map((m) => (
      <button
        aria-selected={mode === m}
        className={clsx(
          styles.modeToggleButton,
          mode === m && styles.modeToggleButtonActive,
        )}
        key={m}
        onClick={() => {
          setMode(m);
        }}
        role="tab"
        type="button"
      >
        {m === "day" ? "By day" : "Stream"}
      </button>
    ))}
  </div>
);

export const MetaBar = ({
  mode,
  setMode,
  lastUpdated,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  lastUpdated: string | undefined;
}) => (
  <div className={styles.metaBar}>
    <ModeToggle mode={mode} setMode={setMode} />

    {lastUpdated && (
      <span className={styles.updated}>
        <span aria-hidden className={styles.updatedDot} />
        Updated {fmtDateShort(lastUpdated)} UTC
      </span>
    )}
  </div>
);
