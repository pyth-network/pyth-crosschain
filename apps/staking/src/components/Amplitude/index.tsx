"use client";

import { useAmplitude } from "../../hooks/use-amplitude";

type Props = {
  apiKey: string | undefined;
};

export const Amplitude = ({ apiKey }: Props) => {
  useAmplitude(apiKey);
  return null;
};
