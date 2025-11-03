"use client";

import { useCallback, useEffect, useState } from "react";

import { useLogger } from "../useLogger";

export const useCopy = (text: string, copyIndicatorTime = 1000) => {
  const [isCopied, setIsCopied] = useState(false);
  const logger = useLogger();
  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
      })
      .catch((error: unknown) => {
        logger.error(error);
      });
  }, [text, logger]);

  useEffect(() => {
    setIsCopied(false);
  }, [text]);

  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, copyIndicatorTime);
      return () => {
        clearTimeout(timeout);
      };
    } else {
      return;
    }
  }, [isCopied, copyIndicatorTime]);

  return { isCopied, copy };
};
