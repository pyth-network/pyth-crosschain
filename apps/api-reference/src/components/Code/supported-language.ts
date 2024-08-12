export const SUPPORTED_LANGUAGES = ["javascript", "solidity", "json"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const isSupportedLanguage = (
  language: string,
): language is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
