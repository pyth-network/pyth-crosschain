export async function register() {
  // biome-ignore lint/style/noProcessEnv: Next.js runtime check requires process.env
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb, markStuckAsFailed } = await import("./lib/db");

    initDb();

    const swept = markStuckAsFailed();
    if (swept > 0) {
      // biome-ignore lint/suspicious/noConsole: Startup logging is intentional
      console.log(`Startup sweep: marked ${swept} stuck exports as failed`);
    }
  }
}
