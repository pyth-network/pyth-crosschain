"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import styles from "./index.module.scss";

type Field = {
  name: string;
  type: string;
};

type FieldCodePanelProps = {
  fields: Field[];
  exampleJson: string;
};

export function FieldCodePanel({ fields, exampleJson }: FieldCodePanelProps) {
  const [highlightedField, setHighlightedField] = useState<string | undefined>(
    undefined,
  );

  const formattedJson = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(exampleJson);
      return JSON.stringify(parsed, undefined, 2);
    } catch {
      return exampleJson.trim();
    }
  }, [exampleJson]);

  const renderHighlightedJson = () => {
    const lines = formattedJson.split("\n");
    return lines.map((line, index) => {
      const fieldPattern = highlightedField
        ? new RegExp(`"${highlightedField}"\\s*:`)
        : undefined;
      const isHighlighted = fieldPattern?.test(line);
      return (
        <span
          key={index}
          className={clsx(
            styles.codeLine,
            isHighlighted && styles.highlightedLine,
          )}
        >
          {line}
          {"\n"}
        </span>
      );
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.hint}>
        Hover over a field to highlight it in the response
      </div>
      <div className={styles.content}>
        <div className={styles.fieldsColumn}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.tableHeader}>Field</th>
                  <th className={styles.tableHeader}>Type</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr
                    key={field.name}
                    className={clsx(
                      styles.row,
                      highlightedField === field.name && styles.highlighted,
                    )}
                    onMouseEnter={() => {
                      setHighlightedField(field.name);
                    }}
                    onMouseLeave={() => {
                      setHighlightedField(undefined);
                    }}
                  >
                    <td className={clsx(styles.tableCell, styles.fieldName)}>
                      <code className={styles.fieldNameCode}>{field.name}</code>
                    </td>
                    <td className={clsx(styles.tableCell, styles.fieldType)}>
                      <span className={styles.typeBadge}>{field.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.codeColumn}>
          <pre className={styles.codeBlock}>{renderHighlightedJson()}</pre>
        </div>
      </div>
    </div>
  );
}
