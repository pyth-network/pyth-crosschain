import { z } from "zod";

export const userSchema = z.object({
  createdAt: z.date(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  id: z.string(),
  image: z.string().url().optional(),
  name: z.string(),
  stripeCustomerId: z.string().optional(),
  updatedAt: z.date(),
});

export const sessionSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date(),
  id: z.string(),
  ipAddress: z.string().optional(),
  token: z.string(),
  updatedAt: z.date(),
  userAgent: z.string().optional(),
  userId: z.string(),
});

export const accountSchema = z.object({
  accessToken: z.string().optional(),
  accessTokenExpiresAt: z.date().optional(),
  accountId: z.string(),
  createdAt: z.date(),
  id: z.string(),
  idToken: z.string().optional(),
  password: z.string().optional(),
  providerId: z.string(),
  refreshToken: z.string().optional(),
  refreshTokenExpiresAt: z.date().optional(),
  scope: z.string().optional(),
  updatedAt: z.date(),
  userId: z.string(),
});

export const verificationSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date(),
  id: z.string(),
  identifier: z.string(),
  updatedAt: z.date(),
  value: z.string(),
});

export const passkeySchema = z.object({
  aaguid: z.string().optional(),
  backedUp: z.boolean(),
  counter: z.number(),
  createdAt: z.date().optional(),
  credentialID: z.string(),
  deviceType: z.string(),
  id: z.string(),
  name: z.string().optional(),
  publicKey: z.string(),
  transports: z.string().optional(),
  userId: z.string(),
});

export const authSchemas = {
  account: accountSchema,
  passkey: passkeySchema,
  session: sessionSchema,
  user: userSchema,
  verification: verificationSchema,
};

export type AuthUser = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof sessionSchema>;
export type AuthAccount = z.infer<typeof accountSchema>;
export type AuthVerification = z.infer<typeof verificationSchema>;
export type AuthPasskey = z.infer<typeof passkeySchema>;
