"use client";

import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Key } from "@phosphor-icons/react/dist/ssr/Key";
import { Button } from "@pythnetwork/component-library/Button";
import { Input } from "@pythnetwork/component-library/Input";
import clsx from "clsx";

import styles from "./index.module.scss";
import { usePlaygroundContext } from "../PlaygroundContext";

type AccessTokenInputProps = {
  className?: string;
};

export function AccessTokenInput({ className }: AccessTokenInputProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const isUsingDemoToken = config.accessToken.trim() === "";

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Key className={styles.icon} weight="duotone" />
          <span className={styles.label}>Access Token</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => {
            window.open(
              "https://docs.pyth.network/price-feeds/pro/acquire-access-token#request-access-token",
              "_blank",
              "noopener,noreferrer",
            );
          }}
          beforeIcon={<ArrowSquareOut weight="regular" />}
        >
          Get your Access Token
        </Button>
      </div>

      <div className={styles.content}>
        <div className={styles.inputWrapper}>
          <Input
            type="password"
            placeholder="Leave empty to use demo token (rate limited)"
            value={config.accessToken}
            onChange={(event) => {
              updateConfig({ accessToken: event.target.value });
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
