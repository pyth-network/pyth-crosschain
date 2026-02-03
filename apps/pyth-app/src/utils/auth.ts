/* eslint-disable n/no-process-env */
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";

const appName = "Pyth App";
const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3344";
const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "DUMMY_BETTER_AUTH_SECRET";
const rpID = new URL(baseURL).hostname;

export const auth = betterAuth({
  appName,
  baseURL,
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    passkey({
      origin: baseURL,
      rpID,
      rpName: appName,
    }),
    emailOTP({
      sendVerificationOTP({ email, otp, type }) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("TODO: Sub. Need to send email OTP", { email, otp, type });
        }

        return Promise.resolve();
      },
    }),
  ],
  secret: authSecret,
  socialProviders: {
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? "DUMMY_APPLE_CLIENT_ID",
      clientSecret:
        process.env.APPLE_CLIENT_SECRET ?? "DUMMY_APPLE_CLIENT_SECRET",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "DUMMY_GITHUB_CLIENT_ID",
      clientSecret:
        process.env.GITHUB_CLIENT_SECRET ?? "DUMMY_GITHUB_CLIENT_SECRET",
    },
    gitlab: {
      clientId: process.env.GITLAB_CLIENT_ID ?? "DUMMY_GITLAB_CLIENT_ID",
      clientSecret:
        process.env.GITLAB_CLIENT_SECRET ?? "DUMMY_GITLAB_CLIENT_SECRET",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "DUMMY_GOOGLE_CLIENT_ID",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ?? "DUMMY_GOOGLE_CLIENT_SECRET",
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "DUMMY_LINKEDIN_CLIENT_ID",
      clientSecret:
        process.env.LINKEDIN_CLIENT_SECRET ?? "DUMMY_LINKEDIN_CLIENT_SECRET",
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? "DUMMY_MICROSOFT_CLIENT_ID",
      clientSecret:
        process.env.MICROSOFT_CLIENT_SECRET ??
        "DUMMY_MICROSOFT_CLIENT_SECRET",
    },
  },
  trustedOrigins: ["https://app.pyth.network", "http://localhost:3344"],
  user: {
    additionalFields: {
      stripeCustomerId: {
        input: false,
        required: false,
        type: "string",
      },
    },
  },
});
