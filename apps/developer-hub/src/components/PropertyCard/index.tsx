import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import Link from "next/link";

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
};

type PropertyCardProps = {
  properties: Property[];
  title?: string;
  isDefaultOpen?: boolean;
};

export function PropertyCard({
  properties,
  title,
  isDefaultOpen = true,
}: PropertyCardProps) {
  // Only open "price", not the first property
  const defaultOpenProperty = isDefaultOpen ? "price" : undefined;

  return (
    <div className={styles.container}>
      {title && <h4 className={styles.groupTitle}>{title}</h4>}
      <Accordions
        type="single"
        {...(defaultOpenProperty ? { defaultValue: defaultOpenProperty } : {})}
      >
        {properties.map((property) => (
          <Accordion key={property.name} title={property.name}>
            <p className={styles.description}>{property.description}</p>

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
                      property.algorithmLink.startsWith("/") ||
                      property.algorithmLink.startsWith("#") ? (
                        <Link
                          href={property.algorithmLink}
                          className={styles.detailLink}
                        >
                          See {property.algorithm.replace("Refer to ", "")}
                        </Link>
                      ) : (
                        <a
                          href={property.algorithmLink}
                          className={styles.detailLink}
                        >
                          See {property.algorithm.replace("Refer to ", "")}
                        </a>
                      )
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
                  <dd className={styles.detailDescription}>{property.usage}</dd>
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
          </Accordion>
        ))}
      </Accordions>
    </div>
  );
}
