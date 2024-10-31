"use client";

import * as amplitude from "@amplitude/analytics-browser";
import { autocapturePlugin } from "@amplitude/plugin-autocapture-browser";
import { useEffect, useRef } from "react";

type Props = {
  apiKey: string;
};

export const Amplitude = ({ apiKey }: Props) => {
  useAmplitude(apiKey);

  // eslint-disable-next-line unicorn/no-null
  return null;
};

const useAmplitude = (apiKey: string) => {
  const amplitudeInitialized = useRef(false);

  useEffect(() => {
    if (!amplitudeInitialized.current) {
      amplitude.add(autocapturePlugin());
      amplitude.init(apiKey, {
        defaultTracking: true,
      });
      amplitudeInitialized.current = true;
    }
  }, [apiKey]);
};
