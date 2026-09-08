# Pyth Developer Hub has moved

The Developer Hub, the documentation site behind
[docs.pyth.network](https://docs.pyth.network), no longer lives in this
repository. It was extracted on 2026-08-24 and is now developed and deployed
from the `pyth-lazer` monorepo:

**https://github.com/pyth-network/pyth-lazer/tree/main/apps/developer-hub**

Open documentation changes there. The layout is unchanged: pages live under
`content/docs/`, product-update entries under `content/changelog/`, and each
section still carries a `meta.json` navigation manifest.

## What is still here

- The final state of this copy is preserved in git history at commit
  [`859113e`](https://github.com/pyth-network/pyth-crosschain/tree/859113e/apps/developer-hub).
  To restore it locally: `git checkout 859113e -- apps/developer-hub`.
- The [`changelog-data`](https://github.com/pyth-network/pyth-crosschain/tree/changelog-data)
  branch remains in this repository. The site's change-log page downloads its
  daily diffs from that branch at build time, and the Hermes job still writes
  to it, so do not delete it.
