/**
 * Pyth answers a multi-feed request with rows only for the feeds it has data
 * for; the others are left out without an error (verified live: a
 * coming_soon feed next to BTC returns only BTC). Name them, so the caller
 * does not read the gap as "no such price".
 */
export function missingFeedsField(
  requestedIds: readonly number[],
  returned: readonly { price_feed_id: number }[],
): { missing_feed_ids?: number[]; missing_feeds_hint?: string } {
  const seen = new Set(returned.map((r) => r.price_feed_id));
  const missing = requestedIds.filter((id) => !seen.has(id));
  if (missing.length === 0) return {};
  return {
    missing_feed_ids: missing,
    missing_feeds_hint:
      "No price was returned for these feeds. They may not be live yet (beta or coming_soon), may not publish on this channel (see min_channel), or may have had no update at this time. Check them with get_symbols.",
  };
}
