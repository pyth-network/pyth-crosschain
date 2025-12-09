import { Select } from "@pythnetwork/component-library/Select";
import { sentenceCase } from "change-case";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllAllowedSymbols } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  ALLOWED_CRYPTO_SYMBOLS,
  ALLOWED_EQUITY_SYMBOLS,
  ALLOWED_FOREX_SYMBOLS,
  ALLOWED_FUTURE_SYMBOLS,
  ALLOWED_REPLAY_SYMBOLS,
  NO_SELECTED_SYMBOL,
  removeReplaySymbolSuffix,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplaySymbol } from "../../util/pyth-pro-demo";

type SourceDropdownOptType = {
  id: AllAllowedSymbols;
};

const GROUPED_OPTS: { name: string; options: SourceDropdownOptType[] }[] = [
  {
    name: "None",
    options: Object.values(NO_SELECTED_SYMBOL.Values).map((id) => ({ id })),
  },
  {
    name: "Crypto",
    options: Object.values(ALLOWED_CRYPTO_SYMBOLS.Values).map((id) => ({ id })),
  },
  {
    name: "Equities (Realtime)",
    options: Object.values(ALLOWED_EQUITY_SYMBOLS.Values).map((id) => ({ id })),
  },
  {
    name: "Equities (Replay)",
    options: Object.values(ALLOWED_REPLAY_SYMBOLS.Values).map((id) => ({
      id,
    })),
  },
  {
    name: "Forex",
    options: Object.values(ALLOWED_FOREX_SYMBOLS.Values).map((id) => ({ id })),
  },
  {
    name: "Futures",
    options: Object.values(ALLOWED_FUTURE_SYMBOLS.Values).map((id) => ({ id })),
  },
];

function renderOptionLabel({
  id,
  isValue,
}: {
  id: number | string;
  isValue: boolean;
}) {
  if (typeof id === "string" && isReplaySymbol(id)) {
    return `${removeReplaySymbolSuffix(id).toUpperCase()} ${isValue ? "(Replay)" : ""}`.trim();
  }

  return id === ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected
    ? sentenceCase(id)
    : String(id).toUpperCase();
}

export function PythProDemoSourceSelector() {
  /** context */
  const { handleSelectSource, selectedSource } = usePythProAppStateContext();

  return (
    <Select
      label={undefined}
      onSelectionChange={handleSelectSource}
      optionGroups={GROUPED_OPTS}
      placeholder="Choose an asset"
      selectedKey={
        selectedSource ?? ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected
      }
      show={({ id }) => renderOptionLabel({ id, isValue: false })}
      textValue={({ id }) => renderOptionLabel({ id, isValue: true })}
    />
  );
}
