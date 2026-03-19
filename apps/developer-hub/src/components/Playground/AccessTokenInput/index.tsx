"use client";

import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Key } from "@phosphor-icons/react/dist/ssr/Key";
import { Button } from "@pythnetwork/component-library/Button";
import { Input } from "@pythnetwork/component-library/Input";
import clsx from "clsx";
import { usePlaygroundContext } from "../PlaygroundContext";
import styles from "./index.module.scss";

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
          beforeIcon={<ArrowSquareOut weight="regular" />}
          onPress={() => {
            window.open(
              "https://docs.pyth.network/price-feeds/pro/acquire-access-token#request-access-token",
              "_blank",
              "noopener,noreferrer",
            );
          }}
          size="sm"
          variant="secondary"
        >
          Get your Access Token
        </Button>
      </div>

      <div className={styles.content}>
        <div className={styles.inputWrapper}>
          <Input
            aria-label="Access Token"
            className={styles.input ?? ""}
            fullWidth
            onChange={(event) => {
              updateConfig({ accessToken: event.target.value });
            }}
            placeholder="Leave empty to use demo token (rate limited)"
            type="password"
            value={config.accessToken}
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
