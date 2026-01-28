"use client";

import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SCROLL_DELAY_AFTER_EXPAND, SCROLL_DELAY_SHORT } from "./constants";
import styles from "./index.module.scss";

type Property = {
  name: string;
  type: string;
  description: string;
  availability?: string;
  algorithm?: string;
  algorithmLink?: string;
  invariants?: string[];
  usage?: string;
  example?: string;
  possibleValues?: string[];
  typicalValues?: string;
  warning?: string;
  note?: string;
};

type PropertyCardProps = {
  properties: Property[];
  title?: string;
  isDefaultOpen?: boolean;
  expandedProperty?: string;
  onPropertyExpanded?: (propertyName: string) => void;
};

export function PropertyCard({
  properties,
  title,
  isDefaultOpen = true,
  expandedProperty,
  onPropertyExpanded,
}: PropertyCardProps) {
  const defaultOpenProperty = isDefaultOpen ? "price" : undefined;
  const [value, setValue] = useState<string | undefined>(
    expandedProperty ?? defaultOpenProperty,
  );
  const propertyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (expandedProperty && expandedProperty !== value) {
      setValue(expandedProperty);
      setTimeout(() => {
        const element = propertyRefs.current[expandedProperty];
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, SCROLL_DELAY_SHORT);
    }
  }, [expandedProperty, value]);

  useEffect(() => {
    const handleExpandProperty = (event: CustomEvent<string>) => {
      const propertyName = event.detail;
      if (properties.some((p) => p.name === propertyName)) {
        setValue(propertyName);
        setTimeout(() => {
          const element = propertyRefs.current[propertyName];
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, SCROLL_DELAY_AFTER_EXPAND);
      }
    };

    const eventName = "expandProperty" as keyof WindowEventMap;
    globalThis.addEventListener(
      eventName,
      handleExpandProperty as EventListener,
    );

    return () => {
      globalThis.removeEventListener(
        eventName,
        handleExpandProperty as EventListener,
      );
    };
  }, [properties]);

  const handleValueChange = (newValue: string | undefined) => {
    setValue(newValue);
    if (newValue && onPropertyExpanded) {
      onPropertyExpanded(newValue);
    }
  };

  // Fumadocs MDX is for static content; for runtime strings with `inline code`
  // we parse backticks and render with the same code style as Usage/Example.
  const renderTextWithInlineCode = (text: string) =>
    text
      .split(/(`[^`]+`)/g)
      .filter((part) => part.length > 0)
      .map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          const codeText = part.slice(1, -1);
          return (
            <code key={index} className={styles.detailCode}>
              {codeText}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      });

  return (
    <div className={styles.container}>
      {title && <h4 className={styles.groupTitle}>{title}</h4>}
      <Accordions
        type="single"
        {...(value === undefined ? {} : { value })}
        onValueChange={handleValueChange}
        {...(defaultOpenProperty && !value
          ? { defaultValue: defaultOpenProperty }
          : {})}
      >
        {properties.map((property) => (
          <div
            key={property.name}
            id={`property-${property.name}`}
            ref={(el) => {
              propertyRefs.current[property.name] = el;
            }}
          >
            <Accordion title={property.name}>
              <p className={styles.description}>
                {renderTextWithInlineCode(property.description)}
              </p>

              <dl className={styles.detailsList}>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>Type</dt>
                  <dd className={styles.detailDescription}>{property.type}</dd>
                </div>
                {property.availability && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Availability</dt>
                    <dd className={styles.detailDescription}>
                      {property.availability}
                    </dd>
                  </div>
                )}
                {property.algorithm && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Algorithm</dt>
                    <dd className={styles.detailDescription}>
                      {property.algorithmLink ? (
                        <Link
                          href={property.algorithmLink}
                          className={styles.detailLink}
                        >
                          See {property.algorithm.replace("Refer to ", "")}
                        </Link>
                      ) : (
                        property.algorithm
                      )}
                    </dd>
                  </div>
                )}
                {property.invariants && property.invariants.length > 0 && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Invariants</dt>
                    <dd className={styles.detailDescription}>
                      {property.invariants.join("; ")}
                    </dd>
                  </div>
                )}
                {property.possibleValues &&
                  property.possibleValues.length > 0 && (
                    <div className={styles.detailItem}>
                      <dt className={styles.detailTerm}>Possible Values</dt>
                      <dd className={styles.valuesList}>
                        {property.possibleValues.map((val) => (
                          <code key={val} className={styles.valueCode}>
                            {val}
                          </code>
                        ))}
                      </dd>
                    </div>
                  )}
                {property.usage && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Usage</dt>
                    <dd className={styles.detailDescription}>
                      {renderTextWithInlineCode(property.usage)}
                    </dd>
                  </div>
                )}
                {property.example && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Example</dt>
                    <dd className={styles.detailDescription}>
                      <code className={styles.detailCode}>
                        {property.example}
                      </code>
                    </dd>
                  </div>
                )}
                {property.typicalValues && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailTerm}>Typical Values</dt>
                    <dd className={styles.detailDescription}>
                      {property.typicalValues}
                    </dd>
                  </div>
                )}
              </dl>

              {property.warning && (
                <Callout type="warn" title="Note">
                  The <code>{property.name}</code> field may be absent if the{" "}
                  {property.name} couldn&apos;t be computed. Use the last valid{" "}
                  {property.name} or wait for a fresh update.
                </Callout>
              )}
              {property.note && (
                <Callout type="info">
                  {property.note
                    .split(/(\[.*?\]\(.*?\))/g)
                    .map((part, index) => {
                      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(part);
                      if (linkMatch?.[1] && linkMatch[2]) {
                        const linkText = linkMatch[1];
                        const linkUrl = linkMatch[2];
                        return (
                          <Link key={index} href={linkUrl}>
                            {linkText}
                          </Link>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    })}
                </Callout>
              )}
            </Accordion>
          </div>
        ))}
      </Accordions>
    </div>
  );
}
