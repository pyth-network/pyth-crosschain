"use client";

import { Button } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";

import type { ProductCardConfigType } from "../Pages/Homepage/home-content-cards";

export function ProductCard({
  title,
  description,
  features,
  quickLinks,
  buttonLabel,
  href,
  badge,
}: ProductCardConfigType) {
  return (
    <div className="bg-fd-card rounded-xl border border-fd-border overflow-hidden">
      <div className="p-6 border-b border-fd-border h-[250px] flex flex-col justify-between items-start">
        <div className="flex flex-col gap-4 items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-medium">{title}</h3>
            {badge && <ProductBadge badge={badge} />}
          </div>
          {description && (
            <p className="opacity-75 text-lg leading-normal">{description}</p>
          )}
        </div>
        <Button href={href} size="sm" variant="solid">
          {buttonLabel}
        </Button>
      </div>
      <div className="p-6 bg-fd-background flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <small className="text-sm font-medium uppercase opacity-50">
            Features
          </small>
          <ul className="flex flex-col gap-2">
            {features?.map((feature, index) => (
              <li key={index} className="inline-flex gap-2">
                {feature.icon && (
                  <span className="opacity-50">{feature.icon}</span>
                )}{" "}
                {feature.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <small className="text-sm font-medium uppercase opacity-50">
            Quick Links
          </small>
          <ul className="flex flex-col gap-2">
            {quickLinks?.map((link, index) => (
              <li key={index}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const ProductBadge = ({ badge }: { badge: string }) => {
  return (
    <div
      className={`rounded-lg  px-2 py-1 text-base border font-medium bg-fd-accent/10 shadow`}
    >
      {badge}
    </div>
  );
};
