import { z } from "zod";

// Tokens are a single run of printable ASCII. Rejecting anything else up
// front matters: a token with a line break inside (a wrapped paste) makes
// fetch throw an "invalid header value" error that quotes the whole token.
const TOKEN_PATTERN = /^[\x21-\x7E]+$/;

export const TOKEN_FORMAT_MESSAGE =
  "access_token must be a single line with no spaces or line breaks. Re-copy the token in one piece.";

export function accessTokenSchema(description: string) {
  return z
    .string()
    .trim()
    .min(1, "access_token must not be empty")
    .regex(TOKEN_PATTERN, TOKEN_FORMAT_MESSAGE)
    .optional()
    .describe(description);
}
