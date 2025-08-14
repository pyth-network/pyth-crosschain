export const PAGE_SIZES = [5, 10, 25, 50, 75, 100] as const;
export type PAGE_SIZE = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PAGE_SIZE = 50;
