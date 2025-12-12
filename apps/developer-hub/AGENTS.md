# Repository Guidelines

## Project Structure & Module Organization

The Developer Hub is a Next.js app rooted in `src/`: routes live under `src/app`, shared UI in `src/components`, config helpers in `src/config`, and utilities in `src/lib`. Documentation sits in `content/docs`, grouped per product with `index.mdx`, supporting guides, and a `meta.json` navigation manifest; assets belong in `public/images`.

## Build, Test, and Development Commands

- `pnpm turbo run start:dev` — Next.js dev server on port 3627 with hot reload.
- `pnpm turbo run build` / `pnpm turbo run start:prod` — Build and preview the production bundle.
- `pnpm turbo run fix:format|fix:lint:eslint|fix:lint:stylelint` — Auto-apply Prettier, ESLint, and Stylelint fixes.
- `pnpm turbo run test:format|test:lint:*|test:types` — CI-aligned format/lint/type checks.
- `pnpm run generate:docs` — Execute `scripts/generate-docs.ts` via Bun for bulk doc updates.

## Coding Style & Naming Conventions

Follow the repo-wide Prettier profile from `@cprussin/prettier-config` and let it win. ESLint extends Next.js rules, so fix warnings rather than disabling them. React components and hooks live in PascalCase files (`src/components/DataWidget.tsx`, `src/lib/usePriceFeed.ts`), while route folders and MDX filenames stay kebab-case (`content/docs/price-feeds/core/index.mdx`). Keep SCSS modules scoped per component and draft styles with the shared design tokens.

## Testing Guidelines

Treat linting and type-checking as the gate: run `pnpm turbo run test:lint:eslint`, `...test:lint:stylelint`, and `...test:types` before review. Jest inherits `@pythnetwork/jest-config`; colocate specs as `*.test.ts(x)` files or `__tests__` folders and run them with `pnpm jest <pattern>`. Trigger at least one production build (`pnpm turbo run build`) whenever you change routing, MDX schema, or generated docs.

## Commit & Pull Request Guidelines

History mixes terse imperatives (`fix`, `tempo`) with occasional scopes (`fix(contract-manager)`), so write short, present-tense summaries, optionally scoped (for example, `add(price-feeds): describe fogo-testnet`). Reference issues and list the scripts you ran. Pull requests should bundle a concise description, screenshots or terminal output for UI/docs edits, documentation impact notes, and confirmation that lint/format/type checks passed. When touching docs navigation, call out the affected `content/docs/.../meta.json` entry.

## Security & Configuration Tips

Never commit secrets: keep `.env*`, API keys, and tokens in local-only files such as `.env.local`, and document placeholders via `.env.example`. Append any ad hoc config to `.gitignore` and confirm with `git status -uall` that nothing sensitive is staged. Review third-party embeds plus config changes (`vercel.json`, route handlers, API clients) for auth, header, and input-validation regressions, and rotate keys if they ever leave trusted secret stores.
