"use client";

import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./index.module.scss";

type Feature = {
  label: string;
  icon?: ReactNode;
};

type QuickLink = {
  label: string;
  href: string;
};

type ProductCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  features?: Feature[];
  quickLinks?: QuickLink[];
  buttonLabel?: string;
  buttonHref?: string;
  external?: boolean;
  className?: string;
};

export function ProductCard({
  title,
  description,
  icon,
  features,
  quickLinks,
  buttonLabel,
  buttonHref,
  external,
  className,
}: ProductCardProps) {
  const router = useRouter();

  const handleButtonClick = () => {
    if (!buttonHref) return;

    if (external) {
      window.open(buttonHref, "_blank", "noopener,noreferrer");
    } else {
      router.push(buttonHref);
    }
  };

  return (
    <div className={clsx(styles.card, className)}>
      <div className={styles.content}>
        <div className={styles.mainContent}>
          <div className={styles.header}>
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
            {icon && <div className={styles.icon}>{icon}</div>}
          </div>

          {features && features.length > 0 && (
            <div className={styles.featuresSection}>
              <p className={styles.sectionLabel}>FEATURES</p>
              <div className={styles.features}>
                {features.map((feature) => (
                  <div key={feature.label} className={styles.featureItem}>
                    <div className={styles.featureIcon}>
                      {feature.icon ?? <Lightning size={12.5} />}
                    </div>
                    <span className={styles.featureLabel}>{feature.label}</span>
                    <div className={styles.featureShadow} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {quickLinks && quickLinks.length > 0 && (
            <div className={styles.quickLinksSection}>
              <p className={styles.sectionLabel}>QUICK LINKS</p>
              <div className={styles.quickLinks}>
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.quickLink}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {buttonLabel && (
          <div className={styles.buttonWrapper}>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleButtonClick();
              }}
              size="md"
              variant="primary"
              className={clsx(styles.button, className)}
            >
              {buttonLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
