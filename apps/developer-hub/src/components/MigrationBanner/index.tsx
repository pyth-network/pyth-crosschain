"use client";

import { Banner } from "fumadocs-ui/components/banner";
import { usePathname } from "next/navigation";

const isMigrationBannerRoute = (pathname: string): boolean => {
  if (pathname === "/") return true;
  if (pathname.startsWith("/price-feeds/core")) return true;
  return false;
};

export const MigrationBanner = () => {
  const pathname = usePathname();
  if (!isMigrationBannerRoute(pathname)) {
    // eslint-disable-next-line unicorn/no-null
    return null;
  }
  return (
    <Banner className="bg-violet-950 text-violet-100 hover:bg-violet-900">
      <a
        href="https://pythdata.app/signup?utm_source=developer-hub&utm_campaign=core-upgrade&utm_content=banner"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        Pyth Core upgrade July 31, 2026. Get your API Key →
      </a>
    </Banner>
  );
};
