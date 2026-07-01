"use client";

import { useState } from "react";

import styles from "./index.module.scss";
import { describeDay, parseSchedule, WEEKDAYS } from "./schedule";

type Preset = { label: string; value: string };

type Props = {
  presets?: Preset[];
  initial?: string;
};

const CUSTOM = "__custom__";

export const ScheduleDecoder = ({ presets, initial }: Props) => {
  const [value, setValue] = useState(initial ?? presets?.[0]?.value ?? "");
  const parsed = parseSchedule(value);
  const isPreset = presets?.some((preset) => preset.value === value) ?? false;

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        {presets && presets.length > 0 && (
          <select
            aria-label="Example schedule"
            className={styles.select}
            onChange={(event) => {
              if (event.target.value !== CUSTOM) {
                setValue(event.target.value);
              }
            }}
            value={isPreset ? value : CUSTOM}
          >
            {presets.map((preset) => (
              <option key={preset.label} value={preset.value}>
                {preset.label}
              </option>
            ))}
            {!isPreset && <option value={CUSTOM}>Custom</option>}
          </select>
        )}
        <input
          aria-label="Schedule string"
          className={styles.input}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          spellCheck={false}
          value={value}
        />
      </div>

      {parsed ? (
        <div className={styles.result}>
          <div className={styles.field}>
            <span className={styles.label}>Timezone</span>
            <code className={styles.tz}>{parsed.timezone}</code>
          </div>
          <table className={styles.week}>
            <tbody>
              {parsed.week.map((day, index) => (
                <tr
                  className={day.kind === "closed" ? styles.closed : undefined}
                  key={WEEKDAYS[index]}
                >
                  <th scope="row">{WEEKDAYS[index]}</th>
                  <td>{describeDay(day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.holidays.length > 0 && (
            <div className={styles.field}>
              <span className={styles.label}>Holiday overrides</span>
              <ul className={styles.holidays}>
                {parsed.holidays.map((holiday, index) => (
                  <li key={`${holiday.monthDay}-${String(index)}`}>
                    <span className={styles.holidayDate}>{holiday.label}</span>
                    <span>{describeDay(holiday.schedule)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.fallback}>
          <span className={styles.label}>
            Could not parse this schedule. Raw value:
          </span>
          <pre className={styles.raw}>{value}</pre>
        </div>
      )}
    </div>
  );
};
