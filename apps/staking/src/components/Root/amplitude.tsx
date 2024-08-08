"use client";

import * as amplitude from "@amplitude/analytics-browser";
import { autocapturePlugin } from "@amplitude/plugin-autocapture-browser";
import { useEffect, useRef } from "react";

type Props = {
  apiKey: string | undefined;
};

export const Amplitude = ({ apiKey }: Props) => {
  const amplitudeInitialized = useRef(false);

  useEffect(() => {
    if (!amplitudeInitialized.current && apiKey) {
      amplitude.add(autocapturePlugin());
      amplitude.init(apiKey, {
        defaultTracking: true,
      });
      amplitudeInitialized.current = true;
    }
  }, [apiKey]);

  // eslint-disable-next-line unicorn/no-null
  return null;
};
