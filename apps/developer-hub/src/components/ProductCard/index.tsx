import Link from "next/link";
import React from "react";

type ProductCardProps = {
  badge: string;
  badgeColor?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: {
    icon: React.ReactNode;
    text: string;
  }[];
  ctaText: string;
  href: string;
  className?: string;
  quickActions?: {
    title: string;
    href: string;
    icon: React.ReactNode;
  }[];
};

export function ProductCard({
  badge,
  badgeColor = "bg-blue-600",
  icon,
  title,
  description,
  features,
  ctaText,
  href,
  className = "",
  quickActions = [],
}: ProductCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ${className}`}
    >
      {/* Header with badge and icon */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`${badgeColor} text-white text-xs font-semibold px-3 py-1.5 rounded-full`}
        >
          {badge}
        </div>
        <div className="text-gray-600 dark:text-gray-400">{icon}</div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-700 dark:text-gray-300 text-sm mb-6 leading-relaxed flex-grow">
        {description}
      </p>

      {/* Features list */}
      <div className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">
              {feature.icon}
            </div>
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
              {feature.text}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mb-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              <div className="text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">
                {action.icon}
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {action.title}
              </span>
              <svg
                className="w-3 h-3 ml-auto text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* Call to action button - pushed to bottom */}
      <div className="mt-auto">
        <Link
          href={href}
          className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-semibold"
        >
          {ctaText}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
