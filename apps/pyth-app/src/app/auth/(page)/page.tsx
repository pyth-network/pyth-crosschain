"use client";

import { Button } from "@pythnetwork/component-library/v2";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";

type SocialProvider =
  | "google"
  | "microsoft"
  | "apple"
  | "github"
  | "gitlab"
  | "linkedin";

const socialProviders: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "microsoft", label: "Continue with Microsoft" },
  { id: "apple", label: "Continue with Apple" },
  { id: "github", label: "Continue with GitHub" },
  { id: "gitlab", label: "Continue with GitLab" },
  { id: "linkedin", label: "Continue with LinkedIn" },
];

export default function AuthPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const handleSocialSignIn = async (provider: SocialProvider): Promise<void> => {
    setIsWorking(true);
    setStatus(undefined);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
    if (error?.message) {
      setStatus(error.message);
    }
    setIsWorking(false);
  };

  const handlePasskey = () => {
    const doHandlePasskey = async () => {
      setIsWorking(true);
      setStatus(undefined);
      const { error } = await authClient.signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess() {
            globalThis.location.href = "/dashboard";
          },
        },
      });
      if (error?.message) {
        setStatus(error.message);
      }
      setIsWorking(false);

    };
    doHandlePasskey().catch((error: unknown) => { setStatus('message' in error ? error.message : String(error)); });
  };

  const handleSendOtp = async (): Promise<void> => {
    setIsWorking(true);
    setStatus(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error?.message) {
      setStatus(error.message);
    } else {
      setOtpRequested(true);
      setStatus("OTP sent. Check your email.");
    }
    setIsWorking(false);
  };

  const handleVerifyOtp = async (): Promise<void> => {
    setIsWorking(true);
    setStatus(undefined);
    const { error } = await authClient.signIn.emailOtp({
      email,
      otp,
    });
    if (error?.message) {
      setStatus(error.message);
    } else {
      globalThis.location.href = "/dashboard";
    }
    setIsWorking(false);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 24,
        margin: "0 auto",
        maxWidth: 520,
        padding: "48px 24px",
        width: "100%",
      }}
    >
      <div>
        <h1>Sign in</h1>
        <p>Use a social account, passkey, or email OTP.</p>
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        {socialProviders.map((provider) => (
          <Button
            key={provider.id}
            disabled={isWorking}
            onClick={() => {
              handleSocialSignIn(provider.id).catch(() => {
                setStatus("Sign-in failed. Try again.");
              });
            }}
          >
            {provider.label}
          </Button>
        ))}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <Button disabled={isWorking} onClick={handlePasskey}>
          Continue with a passkey
        </Button>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <label htmlFor="email">Email address</label>
        <input
          autoComplete="email webauthn"
          disabled={isWorking}
          id="email"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setEmail(event.target.value);
          }}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        <Button disabled={isWorking || email.length === 0} onClick={handleSendOtp}>
          Send OTP
        </Button>

        {otpRequested ? (
          <>
            <label htmlFor="otp">One-time password</label>
            <input
              disabled={isWorking}
              id="otp"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setOtp(event.target.value);
              }}
              placeholder="123456"
              type="text"
              value={otp}
            />
            <Button disabled={isWorking || otp.length === 0} onClick={handleVerifyOtp}>
              Verify OTP
            </Button>
          </>
        ) : undefined}
      </section>

      {status ? <p>{status}</p> : undefined}
    </div>
  );
}
