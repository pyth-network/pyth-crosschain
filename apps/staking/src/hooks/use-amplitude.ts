import * as amplitude from "@amplitude/analytics-browser";
import { autocapturePlugin } from "@amplitude/plugin-autocapture-browser";
import { useEffect, useRef } from "react";

export const useAmplitude = (apiKey: string | undefined) => {
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
};
