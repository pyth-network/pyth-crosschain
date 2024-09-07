"use client";

import { useAmplitude } from "../../hooks/use-amplitude";

type Props = {
  apiKey: string | undefined;
};

export const Amplitude = ({ apiKey }: Props) => {
  useAmplitude(apiKey);

  // eslint-disable-next-line unicorn/no-null
  return null;
};
