"use client";

import { Key } from "@phosphor-icons/react/dist/ssr/Key";
import { Input } from "@pythnetwork/component-library/Input";
import clsx from "clsx";

import styles from "./index.module.scss";

type AccessTokenInputProps = {
  accessToken: string;
  onAccessTokenChange: (token: string) => void;
  className?: string;
};

export function AccessTokenInput({
  accessToken,
  onAccessTokenChange,
  className,
}: AccessTokenInputProps) {
  const isUsingDemoToken = accessToken.trim() === "";

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <Key className={styles.icon} weight="duotone" />
        <span className={styles.label}>Access Token</span>
      </div>

      <div className={styles.content}>
        <div className={styles.inputWrapper}>
          <Input
            type="password"
            placeholder="Leave empty to use demo token (rate limited)"
            value={accessToken}
            onChange={(event) => {
              onAccessTokenChange(event.target.value);
            }}
            fullWidth
            className={styles.input ?? ""}
            aria-label="Access Token"
          />
        </div>

        {isUsingDemoToken && (
          <span className={styles.hint}>
            Using demo token (rate limited for testing)
          </span>
        )}
      </div>
    </div>
  );
}
