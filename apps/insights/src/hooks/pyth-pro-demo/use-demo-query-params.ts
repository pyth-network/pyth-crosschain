/* eslint-disable unicorn/no-null */
import { useQueryState } from "@pythnetwork/react-hooks/nuqs";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import type { PythProDemoQueryParams } from "./types";
import type { AllAllowedSymbols } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  PlaybackSpeedSchema,
  ValidDateSchema,
} from "../../schemas/pyth/pyth-pro-demo-schema";

type PythProDemoQueryParamKeys = keyof PythProDemoQueryParams;

const QUERY_PARAM_KEY_MAPPINGS: Record<PythProDemoQueryParamKeys, string> = {
  playbackSpeed: "playbackSpeed",
  selectedSource: "selectedSource",
  startAt: "startAt",
};

function parsePlaybackSpeedFromQuery(val: string) {
  const validated = PlaybackSpeedSchema.safeParse(val);

  return validated.data ?? 1;
}

function serializePlaybackSpeedToQuery(val: number) {
  // just in case somebody was being cute, we drop all precision
  // from the value
  return val.toFixed(0);
}

function parseSelectedSourceFromQuery(val: string) {
  const validated = ALL_ALLOWED_SYMBOLS.safeParse(val);
  return validated.data ?? "no_symbol_selected";
}

type UseDemoQueryParamsReturnType = PythProDemoQueryParams & {
  updateQuery: <K extends PythProDemoQueryParamKeys>(
    key: K,
    val: Nullish<PythProDemoQueryParams[K]>,
  ) => Promise<void>;
};

/**
 * self-contained, single place to parse and
 * update query params for the feeds demo app
 */
export function useDemoQueryParams(): UseDemoQueryParamsReturnType {
  /** hooks */
  const [startAt, setStartAt] = useQueryState(
    QUERY_PARAM_KEY_MAPPINGS.startAt,
    { defaultValue: "", shallow: true },
  );
  const [playbackSpeed, setSelectedPlaybackSpeed] = useQueryState(
    QUERY_PARAM_KEY_MAPPINGS.playbackSpeed,
    {
      defaultValue: 1,
      parse: parsePlaybackSpeedFromQuery,
      serialize: serializePlaybackSpeedToQuery,
      shallow: true,
    },
  );
  const [selectedSource, setSelectedSource] = useQueryState<AllAllowedSymbols>(
    QUERY_PARAM_KEY_MAPPINGS.selectedSource,
    {
      defaultValue: "no_symbol_selected",
      parse: parseSelectedSourceFromQuery,
      shallow: true,
    },
  );

  /** callbacks */
  const updateQuery = useCallback(
    async function updateQuery<K extends PythProDemoQueryParamKeys>(
      key: K,
      val: Nullish<PythProDemoQueryParams[K]>,
    ) {
      switch (key) {
        case "playbackSpeed": {
          const validated = PlaybackSpeedSchema.safeParse(val);
          if (isNullOrUndefined(val)) {
            await setSelectedPlaybackSpeed(null);
          } else if (validated.data) {
            await setSelectedPlaybackSpeed(validated.data);
          }
          break;
        }
        case "selectedSource": {
          const validated = ALL_ALLOWED_SYMBOLS.safeParse(val);
          if (isNullOrUndefined(val)) {
            await setSelectedSource(null);
          } else if (validated.data) {
            await setSelectedSource(validated.data);
          }
          break;
        }
        case "startAt": {
          const validated = ValidDateSchema.safeParse(val);
          if (isNullOrUndefined(val)) {
            await setStartAt(null);
          } else if (validated.data) {
            await setStartAt(validated.data.toISOString());
          }
          break;
        }
      }
    },
    [setSelectedPlaybackSpeed, setSelectedSource, setStartAt],
  );

  return { playbackSpeed, selectedSource, startAt, updateQuery };
}
