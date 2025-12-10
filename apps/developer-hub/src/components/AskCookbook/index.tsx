"use client";

import dynamic from "next/dynamic";

const BaseAskCookbook = dynamic(() => import("@cookbookdev/docsbot/react"), {
  ssr: false,
});

const COOKBOOK_PUBLIC_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NmE5YTdhZmNhMjA3NDg1NDU1YTIyMDYiLCJpYXQiOjE3MjIzOTQ1NDMsImV4cCI6MjAzNzk3MDU0M30.9gU7TfUlrFJcruL89tm4YPauUmxB6iRJ27mhaNW8fdc";

export const AskCookbook = () => {
  return <BaseAskCookbook apiKey={COOKBOOK_PUBLIC_API_KEY} />;
};
