// export const SUPPORTED_CURRENCY_PAIRS = ["EURUSD"] as const;
// export const SUPPORTED_EQUITIES = ["TSLA"] as const;
// export const SUPPORTED_CRYPTO_CURRENCIES = ["BTC"] as const;

import type {
  SourcePickerDropdownGroup,
  SourcePickerDropdownOption,
} from "../types";
import {
  SUPPORTED_CRYPTO_CURRENCIES,
  SUPPORTED_CURRENCY_PAIRS,
  SUPPORTED_EQUITIES,
} from "../types";

export const SOURCE_PICKER_DROPDOWN_OPTIONS: SourcePickerDropdownOption[] = [
  ...SUPPORTED_CRYPTO_CURRENCIES.map<SourcePickerDropdownOption>((id) => ({
    crypto: true,
    equity: false,
    forex: false,
    id,
  })),
  ...SUPPORTED_EQUITIES.map<SourcePickerDropdownOption>((id) => ({
    crypto: false,
    equity: true,
    forex: true,
    id,
  })),
  ...SUPPORTED_CURRENCY_PAIRS.map<SourcePickerDropdownOption>((id) => ({
    crypto: false,
    equity: false,
    forex: true,
    id,
  })),
].sort((a, b) => a.id.localeCompare(b.id));

const groupedOpts = Object.groupBy(SOURCE_PICKER_DROPDOWN_OPTIONS, (opt) => {
  if (opt.crypto) return "Crypto";
  if (opt.equity) return "Equities";
  if (opt.forex) return "Forex";
  return "Ungrouped";
});

export const SOURCE_PICKER_DROPDOWN_GROUPS: SourcePickerDropdownGroup[] =
  Object.entries(groupedOpts)
    .sort(([groupNameA], [groupNameB]) => groupNameA.localeCompare(groupNameB))
    .map(([groupName, options]) => ({
      name: groupName,
      options: options,
    }));
