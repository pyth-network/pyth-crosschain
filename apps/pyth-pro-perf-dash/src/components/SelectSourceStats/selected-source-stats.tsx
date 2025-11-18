"use client";

import { useSelectedSourceStats, useSelectedSourceStream } from "../../hooks";

export function SelectSourceStats() {
  /** hooks */
  const { crypto, equities, forex, selectedSource } = useSelectedSourceStats();
  useSelectedSourceStream();

  return <div>stats</div>;
}
