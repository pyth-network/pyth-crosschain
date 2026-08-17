"use client";

import { Banner } from "fumadocs-ui/components/banner";
import Link from "next/link";
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
      <Link
        className="hover:underline"
        href="/price-feeds/core/upgrade/preparing"
      >
        Pyth Core upgrade August 26, 2026 at 16:00 UTC. Every Core user will
        need an API Key. Learn more →
      </Link>
    </Banner>
  );
};
