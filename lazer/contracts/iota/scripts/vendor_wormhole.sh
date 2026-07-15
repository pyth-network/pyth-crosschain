#!/usr/bin/env bash

set -euo pipefail

print_usage() {
    cat <<'EOF'
vendor_wormhole.sh — vendor the upstream Wormhole Sui contract for IOTA.

Instead of keeping a hand-maintained copy of wormhole-foundation/wormhole's
`sui/wormhole` package, this script rebuilds the IOTA-compatible vendor tree
from upstream on demand.

Usage:
  vendor_wormhole.sh [--repo REPO] [--ref REF] --chain-id CHAIN_ID TARGET_DIR

Options:
  --repo REPO       Git URL of the Wormhole repo.
                    Default: https://github.com/wormhole-foundation/wormhole.git
  --ref REF         Git ref (branch / tag / commit) to vendor.
                    Default: the pinned commit the patches were written against.
                    Bumping this may require refreshing the patches.
  --chain-id ID     Wormhole chain ID for this network (u16, e.g. 60085 for
                    IOTA). Required.
  TARGET_DIR        Where to place the vendored `wormhole` package. Removed
                    first if it already exists.

Run from anywhere; patches are resolved relative to this script.
EOF
}

DEFAULT_REPO="https://github.com/wormhole-foundation/wormhole.git"
# Pinned upstream commit the patches in ./patches were authored against.
DEFAULT_REF="c5a2eabe0a48654fcb1d3c98537915c2fb671c80"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$SCRIPT_DIR/patches"

die() {
    echo "error: $*" >&2
    exit 1
}

# `--help` / `-h`: print usage to stdout and exit 0.
usage() {
    print_usage
    exit 0
}

# Invalid args: print the error and the usage text to stderr, then exit 2.
die_usage() {
    echo "error: $*" >&2
    echo >&2
    print_usage >&2
    exit 2
}

REPO="$DEFAULT_REPO"
REF="$DEFAULT_REF"
CHAIN_ID=""
TARGET_DIR=""

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)     REPO="$2";     shift 2 ;;
        --ref)      REF="$2";      shift 2 ;;
        --chain-id) CHAIN_ID="$2"; shift 2 ;;
        -h|--help)  usage ;;
        --*)        die_usage "unknown option: $1" ;;
        *)
            if [ -z "$TARGET_DIR" ]; then
                TARGET_DIR="$1"; shift
            else
                die_usage "unexpected argument: $1"
            fi
            ;;
    esac
done

[ -n "$CHAIN_ID" ] || die_usage "--chain-id is required"
[ "$CHAIN_ID" -ge 0 ] && [ "$CHAIN_ID" -le 65535 ] \
    || die_usage "--chain-id must fit in a u16 (0-65535), got $CHAIN_ID"

[ -n "$TARGET_DIR" ] || die_usage "TARGET_DIR is required"
case "$TARGET_DIR" in
    /*) : ;;
    *)  TARGET_DIR="$PWD/$TARGET_DIR" ;;
esac

command -v git   >/dev/null 2>&1 || die "git is required"
command -v patch >/dev/null 2>&1 || die "patch is required"

if [ ! -d "$PATCHES_DIR" ] || ! ls "$PATCHES_DIR"/[0-9]*.patch >/dev/null 2>&1; then
    die "no patches found in $PATCHES_DIR"
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Fetching $REPO @ $REF"
git clone --quiet --filter=blob:none --no-checkout "$REPO" "$WORK_DIR/repo"
git -C "$WORK_DIR/repo" sparse-checkout init --cone >/dev/null
git -C "$WORK_DIR/repo" sparse-checkout set sui/wormhole >/dev/null
git -C "$WORK_DIR/repo" checkout --quiet "$REF"

SRC_PKG="$WORK_DIR/repo/sui/wormhole"
[ -d "$SRC_PKG" ] || die "sui/wormhole not found at ref $REF"

echo "==> Populating $TARGET_DIR (overwriting if present)"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -R "$SRC_PKG/." "$TARGET_DIR/"

# Drop build artefacts / lockfiles that shouldn't be vendored.
rm -f "$TARGET_DIR/Move.lock" "$TARGET_DIR/Published.toml"
rm -rf "$TARGET_DIR/build" "$TARGET_DIR/.git"

echo "==> Rewriting Sui -> Iota"
"$SCRIPT_DIR/sui-to-iota.sh" "$TARGET_DIR" >/dev/null

echo "==> Applying static patches"
for patch_file in "$PATCHES_DIR"/[0-9]*.patch; do
    echo "    - $(basename "$patch_file")"
    patch -p1 -d "$TARGET_DIR" -s --no-backup-if-mismatch < "$patch_file" \
        || die "patch failed: $(basename "$patch_file")"
done

echo "==> Applying chain-id patch (CHAIN_ID=$CHAIN_ID)"
chain_id_patch="$WORK_DIR/chain-id.patch"
sed "s/__CHAIN_ID__/$CHAIN_ID/g" \
    "$PATCHES_DIR/chain-id.patch.tmpl" > "$chain_id_patch"
patch -p1 -d "$TARGET_DIR" -s --no-backup-if-mismatch < "$chain_id_patch" \
    || die "chain-id patch failed to apply"

echo "==> Done: $TARGET_DIR"
echo "    Verify with: iota move test -p $TARGET_DIR"
