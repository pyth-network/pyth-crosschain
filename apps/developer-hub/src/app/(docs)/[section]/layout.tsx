import { Banner } from "fumadocs-ui/components/banner";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import Link from "next/link";
import type { ReactNode } from "react";

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
                target="_blank"
                rel="noopener noreferrer"
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
      <DocsLayout {...docsOptions}>{children}</DocsLayout>
    </>
  );
}
