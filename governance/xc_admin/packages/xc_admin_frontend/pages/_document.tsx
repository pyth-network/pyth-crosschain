import { Head, Html, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=Urbanist:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="/public/favicon.ico"
          id="faviconTag"
          rel="icon"
          type="image/x-icon"
        />
        <link
          href="/apple-touch-icon.png"
          rel="apple-touch-icon"
          sizes="180x180"
        />
        <link
          href="/favicon-32x32.png"
          rel="icon"
          sizes="32x32"
          type="image/png"
        />
        <link
          href="/favicon-16x16.png"
          rel="icon"
          sizes="16x16"
          type="image/png"
        />
        <link href="/site.webmanifest" rel="manifest" />
        <link color="#242235" href="/safari-pinned-tab.svg" rel="mask-icon" />
        <meta content="#242235" name="msapplication-TileColor" />
        <meta content="#242235" name="theme-color"></meta>
        <Script id="show-banner" strategy="beforeInteractive">
          {`const faviconTag = document.getElementById("faviconTag");
            const isDark = window.matchMedia("(prefers-color-scheme: dark)");
            const changeFavicon = () => {
              if (isDark.matches) faviconTag.href = "/favicon-light.ico";
              else faviconTag.href = "/favicon.ico";
            };
            changeFavicon();
            setInterval(changeFavicon, 1000);`}
        </Script>
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
