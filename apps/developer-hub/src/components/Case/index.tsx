export const CASE_VARIANTS = [
  "Uppercase",
  "Lowercase",
  "Title Case",
  "APA Title Case",
  "Sentence Case",
  "Snake Case",
  "Kebab Case",
  "Pascal Case",
  "Camel Case",
  "Train Case",
  "Macro Case",
] as const;

export type CaseVariant = (typeof CASE_VARIANTS)[number];

type Props = {
  children: string;
  variant: CaseVariant;
};

export const Case = ({ children, variant }: Props) => {
  const convertedText = convertCase(children, variant);
  return <>{convertedText}</>;
};

const convertCase = (text: string, variant: CaseVariant): string => {
  switch (variant) {
    case "Uppercase":
      return text.toUpperCase();
    case "Lowercase":
      return text.toLowerCase();
    case "Title Case":
      return toTitleCase(text);
    case "APA Title Case":
      return toAPATitleCase(text);
    case "Sentence Case":
      return toSentenceCase(text);
    case "Snake Case":
      return toSnakeCase(text);
    case "Kebab Case":
      return toKebabCase(text);
    case "Pascal Case":
      return toPascalCase(text);
    case "Camel Case":
      return toCamelCase(text);
    case "Train Case":
      return toTrainCase(text);
    case "Macro Case":
      return toMacroCase(text);
    default:
      return text;
  }
};

// Convert to Title Case (capitalize first letter of each word)
const toTitleCase = (text: string): string => {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Convert to APA Title Case (capitalize first letter of each word except articles, prepositions, and conjunctions)
const toAPATitleCase = (text: string): string => {
  const minorWords = [
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "on",
    "at",
    "to",
    "from",
    "by",
    "in",
    "of",
  ];

  const words = text.toLowerCase().split(" ");

  // Always capitalize the first and last word
  return words
    .map((word, index) => {
      // Always capitalize first and last word
      if (index === 0 || index === words.length - 1) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Check if the word is a minor word
      if (minorWords.includes(word)) {
        return word;
      }

      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

// Convert to Sentence Case (capitalize only the first letter of the first word)
const toSentenceCase = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Convert to Snake Case (lowercase with underscores between words)
const toSnakeCase = (text: string): string => {
  return text
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, "_"); // Replace spaces with underscores
};

// Convert to Kebab Case (lowercase with hyphens between words)
const toKebabCase = (text: string): string => {
  return text
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, "-"); // Replace spaces with hyphens
};

// Convert to Pascal Case (capitalize first letter of each word, no spaces)
const toPascalCase = (text: string): string => {
  return text
    .replace(/[^\w\s]/g, "") // Remove special characters
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
};

// Convert to Camel Case (first word lowercase, capitalize first letter of subsequent words, no spaces)
const toCamelCase = (text: string): string => {
  const pascalCase = toPascalCase(text);
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
};

// Convert to Train Case (capitalize first letter of each word, hyphens between words)
const toTrainCase = (text: string): string => {
  return text
    .replace(/[^\w\s]/g, "") // Remove special characters
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-");
};

// Convert to Macro Case (uppercase with underscores between words)
const toMacroCase = (text: string): string => {
  return toSnakeCase(text).toUpperCase();
};
