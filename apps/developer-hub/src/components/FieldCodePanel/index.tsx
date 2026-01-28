"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import styles from "./index.module.scss";
import { FIELDS_WITHOUT_SPECS } from "../PropertyCard/constants";

type Field = {
  name: string;
  type: string;
};

type FieldCodePanelProps = {
  fields: Field[];
  exampleJson: string;
};

function hasDetailedSpecs(fieldName: string) {
  return !(FIELDS_WITHOUT_SPECS as readonly string[]).includes(fieldName);
}

function handleFieldClick(fieldName: string) {
  const event = new CustomEvent("propertyFieldClick", {
    detail: fieldName,
  });
  globalThis.dispatchEvent(event);
}

export function FieldCodePanel({ fields, exampleJson }: FieldCodePanelProps) {
  const [highlightedField, setHighlightedField] = useState<string | undefined>(
    undefined,
  );
  const [hoveredFieldWithSpecs, setHoveredFieldWithSpecs] = useState<
    string | undefined
  >(undefined);

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
      <div className={styles.hint}>Hover over a field to highlight it</div>
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
                {fields.map((field) => {
                  const fieldHasSpecs = hasDetailedSpecs(field.name);
                  return (
                    <tr
                      key={field.name}
                      className={clsx(
                        styles.row,
                        styles.clickable,
                        highlightedField === field.name && styles.highlighted,
                      )}
                      onMouseEnter={() => {
                        setHighlightedField(field.name);
                        if (fieldHasSpecs) {
                          setHoveredFieldWithSpecs(field.name);
                        }
                      }}
                      onMouseLeave={() => {
                        setHighlightedField(undefined);
                        setHoveredFieldWithSpecs(undefined);
                      }}
                      onClick={() => {
                        handleFieldClick(field.name);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleFieldClick(field.name);
                        }
                      }}
                    >
                      <td className={clsx(styles.tableCell, styles.fieldName)}>
                        <code className={styles.fieldNameCode}>
                          {field.name}
                        </code>
                        {hoveredFieldWithSpecs === field.name && (
                          <div className={styles.fieldHint}>
                            Click to view detailed documentation
                          </div>
                        )}
                      </td>
                      <td className={clsx(styles.tableCell, styles.fieldType)}>
                        <span className={styles.typeBadge}>{field.type}</span>
                      </td>
                    </tr>
                  );
                })}
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
