"use client";

import { useEffect } from "react";

export const ActiveStepHighlighter = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    if (!step) return;
    const element = document.getElementById(step);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    element.classList.add("migration-step-active");
    const timeout = setTimeout(() => {
      element.classList.remove("migration-step-active");
    }, 4000);
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // eslint-disable-next-line unicorn/no-null
  return null;
};
