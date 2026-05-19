"use client";

import clsx from "clsx";
import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./index.module.scss";

type MermaidProps = {
  chart: string;
  className?: string;
};

export const Mermaid = ({ chart, className }: MermaidProps) => {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "dark" ? "dark" : "default",
        securityLevel: "strict",
      });
      const renderId = `mermaid-${reactId.replaceAll(/[^a-zA-Z0-9]/g, "")}`;
      try {
        const { svg: rendered } = await mermaid.render(
          renderId,
          chart,
          containerRef.current ?? undefined,
        );
        if (!cancelled) setSvg(rendered);
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Mermaid render error:", error);
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={clsx(styles.mermaid, className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default Mermaid;
