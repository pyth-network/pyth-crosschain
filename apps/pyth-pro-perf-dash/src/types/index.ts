import type { ArrayValues } from "type-fest";

export const SUPPORTED_CURRENCY_PAIRS = ["EURUSD"] as const;
export const SUPPORTED_EQUITIES = ["TSLA"] as const;
export const SUPPORTED_CRYPTO_CURRENCIES = ["BTC"] as const;

export type SupportedCurrencyPairs = ArrayValues<
  typeof SUPPORTED_CURRENCY_PAIRS
>;
export type SupportedEquities = ArrayValues<typeof SUPPORTED_EQUITIES>;
export type SupportedCryptoCurrencies = ArrayValues<
  typeof SUPPORTED_CRYPTO_CURRENCIES
>;

export type DataPoint = {
  timestamp: number;
  value: number;
};

export type SourcePickerDropdownOption = {
  id: string;
  crypto: boolean;
  equity: boolean;
  forex: boolean;
};

export type SourcePickerDropdownGroup = {
  name: string;
  options: SourcePickerDropdownOption[];
};

export type PythProPerfDashState = {
  crypto: Partial<Record<SupportedCryptoCurrencies, DataPoint[]>>;
  equities: Partial<Record<SupportedEquities, DataPoint[]>>;
  forex: Partial<Record<SupportedCurrencyPairs, DataPoint[]>>;
  setDataPoint: <K extends StateKeys, K2 extends keyof PythProPerfDashState[K]>(
    which: K,
    thing: K2,
    dataPoint: DataPoint,
  ) => void;
  selectedSource: SourcePickerDropdownOption;
  setSelectedSource: (opt: SourcePickerDropdownOption) => void;
};

export type StateKeys = keyof Omit<PythProPerfDashState, "setDataPoint">;
