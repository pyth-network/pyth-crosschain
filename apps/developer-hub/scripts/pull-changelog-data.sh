#!/usr/bin/env bash
#
# Pull the per-day change-log diffs from the `changelog-data` branch into the
# local data dir so `generate:changelog` can bundle them. Those diffs are not
# committed on main (see .gitignore) — Hermes writes them to `changelog-data`
# daily, and this step hydrates them at build time.
#
# On any failure (offline, branch missing, no diffs yet) it leaves whatever is
# already local and exits 0, so the build never breaks; the page just renders
# fewer or no days.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "pull:changelog — not a git repo; skipping."
  exit 0
}
DIR="apps/developer-hub/data/changelog-diffs"
mkdir -p "$ROOT/$DIR"

if ! git -C "$ROOT" fetch origin changelog-data --depth=1 2>/dev/null; then
  echo "pull:changelog — could not fetch changelog-data; using local diffs (if any)."
  exit 0
fi

if git -C "$ROOT" archive FETCH_HEAD -- "$DIR" 2>/dev/null | tar -x -C "$ROOT" 2>/dev/null; then
  count="$(find "$ROOT/$DIR" -name '*.json' | wc -l | tr -d ' ')"
  echo "pull:changelog — pulled ${count} diff file(s) from changelog-data."
else
  echo "pull:changelog — changelog-data has no diffs path yet; using local diffs (if any)."
fi

exit 0
