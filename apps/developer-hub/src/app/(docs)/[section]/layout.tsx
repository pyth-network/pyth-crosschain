import { Banner } from "fumadocs-ui/components/banner";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChangelogBar } from "../../../components/ChangelogBar";
import { MigrationBanner } from "../../../components/MigrationBanner";
import { docsOptions } from "../../../config/layout.config";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  return (
    <>
      {section === "entropy" && (
        <Banner changeLayout={false} id="entropy-v2" variant="rainbow">
          <span>
            <strong>
              Try the{" "}
              <a
                href="https://entropy-explorer.pyth.network/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Entropy Explorer
              </a>
            </strong>{" "}
            to track and debug callback issues. &nbsp;|&nbsp;
            <Link href="/entropy/whats-new-entropyv2">
              Learn what&apos;s new in Entropy v2.
            </Link>
          </span>
        </Banner>
      )}
      {section === "oracle-integrity-staking" && (
        <Banner
          changeLayout={false}
          className="min-h-12 bg-amber-950 py-2 text-amber-100"
          height="auto"
        >
          <span>
            <strong>OIS rewards are paused.</strong> Staking and slashing remain
            active — stake is still at risk of slashing. &nbsp;|&nbsp;
            <a
              className="underline"
              href="https://forum.pyth.network/t/ois-rewards-update-april-2026/2479"
              rel="noopener noreferrer"
              target="_blank"
            >
              Read the governance update.
            </a>
          </span>
        </Banner>
      )}
      {section === "price-feeds" && <MigrationBanner />}
      <ChangelogBar />
      <DocsLayout {...docsOptions}>{children}</DocsLayout>
    </>
  );
}
