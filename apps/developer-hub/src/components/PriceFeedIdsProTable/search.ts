import { matchSorter } from "match-sorter";

export type SearchableFeed = {
  pyth_lazer_id: number;
  symbol: string;
  name: string;
  description: string;
  hermes_id?: string | null | undefined;
  nasdaq_symbol?: string | null | undefined;
  cmc_id?: number | null | undefined;
};

const stripHexPrefix = (value: string): string =>
  value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;

export const filterFeedsBySearch = <T extends SearchableFeed>(
  items: T[],
  searchString: string,
): T[] => {
  if (!searchString) {
    return items;
  }

  // Split by commas or spaces to support multiple search terms
  const searchTerms = searchString
    .split(/[,\s]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);

  if (searchTerms.length === 0) {
    return items;
  }

  // For single term, use matchSorter directly for better ranking
  const firstTerm = searchTerms[0];
  if (searchTerms.length === 1 && firstTerm !== undefined) {
    // Strip a leading 0x so users can paste a hermes_id in either form.
    // Non-hermes fields won't spuriously match a 64-char hex string.
    const normalizedTerm = stripHexPrefix(firstTerm);
    return matchSorter(items, normalizedTerm, {
      keys: [
        "pyth_lazer_id",
        "symbol",
        "name",
        "description",
        "hermes_id",
        "nasdaq_symbol",
        "cmc_id",
      ],
    });
  }

  // For multiple terms, use exact/substring matching with OR logic
  // This ensures each term finds its specific matches
  const termMatchesItem = (item: T, term: string): boolean => {
    // Numeric ID match - exact match for numeric terms against pyth_lazer_id or cmc_id
    if (/^\d+$/.test(term)) {
      if (String(item.pyth_lazer_id) === term) return true;
      if (
        item.cmc_id !== null &&
        item.cmc_id !== undefined &&
        String(item.cmc_id) === term
      )
        return true;
      return false;
    }

    // String match - case-insensitive substring match
    const symbol = item.symbol.toLowerCase();
    const name = item.name.toLowerCase();
    const description = item.description.toLowerCase();

    if (
      symbol.includes(term) ||
      name.includes(term) ||
      description.includes(term)
    ) {
      return true;
    }

    if (item.nasdaq_symbol?.toLowerCase().includes(term)) return true;

    if (item.hermes_id !== null && item.hermes_id !== undefined) {
      const hermesTerm = stripHexPrefix(term);
      if (hermesTerm && item.hermes_id.toLowerCase().includes(hermesTerm)) {
        return true;
      }
    }

    return false;
  };

  // Collect matches with priority: exact pyth_lazer_id matches first, then others
  const exactIdMatches: T[] = [];
  const otherMatches = new Map<number, T>();

  for (const term of searchTerms) {
    const isNumericTerm = /^\d+$/.test(term);
    for (const item of items) {
      if (termMatchesItem(item, term)) {
        // Exact pyth_lazer_id matches get priority
        if (isNumericTerm && String(item.pyth_lazer_id) === term) {
          if (
            !exactIdMatches.some((m) => m.pyth_lazer_id === item.pyth_lazer_id)
          ) {
            exactIdMatches.push(item);
          }
        } else if (
          !exactIdMatches.some((m) => m.pyth_lazer_id === item.pyth_lazer_id)
        ) {
          otherMatches.set(item.pyth_lazer_id, item);
        }
      }
    }
  }

  // Return exact pyth_lazer_id matches first, then other matches sorted by ID
  const exactIds = new Set(exactIdMatches.map((m) => m.pyth_lazer_id));
  const otherMatchesArray = [...otherMatches.values()]
    .filter((item) => !exactIds.has(item.pyth_lazer_id))
    .sort((a, b) => a.pyth_lazer_id - b.pyth_lazer_id);
  return [...exactIdMatches, ...otherMatchesArray];
};
