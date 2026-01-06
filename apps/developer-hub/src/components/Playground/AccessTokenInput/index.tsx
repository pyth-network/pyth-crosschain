"use client";

import { Key } from "@phosphor-icons/react/dist/ssr/Key";
import { Input } from "@pythnetwork/component-library/Input";
import { Switch } from "@pythnetwork/component-library/Switch";
import clsx from "clsx";

import styles from "./index.module.scss";

type AccessTokenInputProps = {
  accessToken: string;
  useDemoToken: boolean;
  onAccessTokenChange: (token: string) => void;
  onUseDemoTokenChange: (useDemoToken: boolean) => void;
  className?: string;
};

export function AccessTokenInput({
  accessToken,
  useDemoToken,
  onAccessTokenChange,
  onUseDemoTokenChange,
  className,
}: AccessTokenInputProps) {
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
            placeholder="Paste your Pyth Pro access token..."
            value={useDemoToken ? "" : accessToken}
            onChange={(event) => {
              onAccessTokenChange(event.target.value);
            }}
            disabled={useDemoToken}
            fullWidth
            className={styles.input ?? ""}
            aria-label="Access Token"
          />
        </div>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.switchWrapper}>
          <Switch
            isSelected={useDemoToken}
            onChange={onUseDemoTokenChange}
            className={styles.switch ?? ""}
          >
            Use Demo Token
          </Switch>
          <span className={styles.hint}>Rate limited for testing</span>
        </div>
      </div>
    </div>
  );
}

