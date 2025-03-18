#!/bin/sh

# Vercel currently does not properly enable corepack when running the
# ignoreCommand.  This was recommended as a stopgap by Vercel support until they
# fix that issue.
COREPACK_ROOT="$PWD/.corepack"
COREPACK_SHIM="$COREPACK_ROOT/shim"
export COREPACK_HOME="$COREPACK_ROOT/home"
export PATH="$COREPACK_SHIM:$PATH"
mkdir -p "$COREPACK_HOME"
mkdir -p "$COREPACK_SHIM"
corepack enable --install-directory "$COREPACK_SHIM"

exec pnpm dlx turbo-ignore --fallback=HEAD^
