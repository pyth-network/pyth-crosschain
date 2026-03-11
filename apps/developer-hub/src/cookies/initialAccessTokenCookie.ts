import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// biome-ignore lint/style/noProcessEnv: this is the only place we need to read this value from the env
const cookieSigningSecret = process.env.COOKIE_SIGNING_SECRET ?? "";

const INITIAL_ACCESS_TOKEN_COOKIE_NAME =
  "developer-playground-initial-access-token" as const;

const initialAccessTokenSchema = z.object({
  initialAccessToken: z.string().optional().nullable(),
});

const key = scryptSync(cookieSigningSecret, "pyth-hub", 32);

function encrypt(value: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(value: string): string | null {
  try {
    const data = Buffer.from(value, "base64");
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return null;
  }
}

async function setInitialAccessToken(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  try {
    const contentType = request.headers.get("content-type") || "";
    let body: unknown;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.text();
      const params = new URLSearchParams(formData);
      body = {
        initialAccessToken: params.get("initialAccessToken"),
      };
    } else {
      body = await request.json(); // Default to JSON
    }

    const parsed = initialAccessTokenSchema.safeParse(body);

    if (parsed.success) {
      const c = await cookies();
      c.set(
        INITIAL_ACCESS_TOKEN_COOKIE_NAME,
        encrypt(JSON.stringify(parsed.data)),
        {
          httpOnly: true,
          maxAge: 60, // 60 seconds
          path: "/playground",
          sameSite: "lax",
          secure: true,
        },
      );
    }
  } catch {
    /* don't care if it failed, just continue on to developer hub */
  }

  return NextResponse.next();
}

async function getInitialAccessToken() {
  const c = await cookies();
  const encrypted = c.get(INITIAL_ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!encrypted) return null;

  const decrypted = decrypt(encrypted);
  if (!decrypted) return null;

  try {
    const parsed = initialAccessTokenSchema.safeParse(JSON.parse(decrypted));
    if (parsed.success) return parsed.data;
  } catch {
    /* no-op */
  }
  return null;
}

export const Cookies = {
  /** returns the initialAccessToken to use for the playground, if it's present */
  getInitialAccessToken,

  /** sets the initalAccessToken from a POST request from another Pyth-related app, if the token is present */
  setInitialAccessToken,
};
