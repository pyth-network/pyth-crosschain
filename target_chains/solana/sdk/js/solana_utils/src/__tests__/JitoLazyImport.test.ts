// Regression test for https://github.com/pyth-network/pyth-crosschain/issues/1838.
//
// `jito.ts` historically eager-imported `jito-ts/dist/sdk/block-engine/{searcher,types}`,
// which transitively required `jito-ts`'s nested `@solana/web3.js@~1.77.3` ->
// `rpc-websockets/dist/lib/client` — a path removed in `rpc-websockets@>=7.11`.
// Consumers that loaded any `@pythnetwork/solana-utils` export therefore
// crashed with `Cannot find module 'rpc-websockets/dist/lib/client'`, even
// when they never used the Jito helpers.
//
// We now type-only-import `SearcherClient`/`Bundle` and dynamic-import
// `Bundle` inside `sendTransactionsJito`. This test guards that contract.

describe("jito-ts lazy loading", () => {
  it("does not load jito-ts when importing transaction helpers", async () => {
    await import("../transaction");

    const cachedJitoPath = Object.keys(require.cache).find((p) =>
      p.includes(`${"/node_modules/"}jito-ts/`),
    );

    expect(cachedJitoPath).toBeUndefined();
  });

  it("does not load jito-ts when importing jito.ts itself", async () => {
    await import("../jito");

    const cachedJitoPath = Object.keys(require.cache).find((p) =>
      p.includes(`${"/node_modules/"}jito-ts/`),
    );

    expect(cachedJitoPath).toBeUndefined();
  });
});
