import type { ReactNode } from "react";

export const metadata = {
  description: "Internal tool for historical Pyth Lazer price data exports",
  title: "Pyth Data Puller",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0f0f0f",
          color: "#e0e0e0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <div style={{ margin: "0 auto", maxWidth: 1200 }}>{children}</div>
      </body>
    </html>
  );
}
