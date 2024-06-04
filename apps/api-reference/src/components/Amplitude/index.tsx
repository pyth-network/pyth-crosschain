"use client";

import { init } from "@amplitude/analytics-browser";
import { useEffect } from "react";

type Props = {
  key: string;
};

export const Amplitude = ({ key }: Props) => {
  useEffect(() => {
    init(key);
  }, [key]);
  // eslint-disable-next-line unicorn/no-null
  return null;
};
