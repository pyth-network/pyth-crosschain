#!/usr/bin/env bash
#
# Pull the per-day change-log diffs from the `changelog-data` branch into the
# local data dir so `generate:changelog` can bundle them. Those diffs are not
# committed on main (see .gitignore) — Hermes writes them to `changelog-data`
# daily, and this step hydrates them at build time.
#
# It downloads the branch tarball over plain HTTPS from GitHub (public repo) —
# NOT `git fetch`. Vercel's build sandbox is a shallow, single-branch clone
# where `git fetch <other-branch>` does not work; that silently left the page
# with zero days. codeload needs no auth, no API token, and is not subject to
# the GitHub API rate limit.
#
# On any failure (offline, branch missing, no diffs yet) it leaves whatever is
# already local and exits 0, so the build never breaks; the page just renders
# fewer or no days.

set -uo pipefail

REPO="pyth-network/pyth-crosschain"
BRANCH="changelog-data"
DIR="apps/developer-hub/data/changelog-diffs"
URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"

# Repo root: prefer git, fall back to this script's location (apps/developer-hub/scripts).
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" \
  || ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

mkdir -p "$ROOT/$DIR"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if curl -fsSL "$URL" -o "$tmp/cl.tgz" 2>/dev/null \
  && tar -xzf "$tmp/cl.tgz" -C "$tmp" --strip-components=1 2>/dev/null \
  && [ -d "$tmp/$DIR" ]; then
  find "$tmp/$DIR" -name '*.json' -exec cp -f {} "$ROOT/$DIR/" \;
  count="$(find "$ROOT/$DIR" -name '*.json' | wc -l | tr -d ' ')"
  echo "pull:changelog — pulled change-log diffs from ${BRANCH} (${count} file(s) total)."
else
  echo "pull:changelog — could not fetch ${BRANCH} over https; using local diffs (if any)."
fi

exit 0
