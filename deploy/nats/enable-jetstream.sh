#!/usr/bin/env bash
#
# Grants the APP account JetStream storage/memory limits on an installation that ALREADY
# EXISTS — the counterpart of bootstrap.sh's own JetStream edit, for an identity that was
# generated before JetStream was a thing (or that ran without this script's help).
#
# WHY IT IS NOT PART OF bootstrap.sh's ONE-SHOT RUN
#   bootstrap.sh now grants these limits itself, but only at the moment it creates the
#   identity — because it is the only moment the operator's signing key exists (see below).
#   This script is for the installation that already ran bootstrap.sh before that existed,
#   or that needs to change the limits later without touching anything else.
#
# WHY THIS NEEDS THE OPERATOR KEY AND add-events-user.sh DID NOT
#   JetStream storage and memory limits live in the ACCOUNT JWT, and an account JWT is
#   signed by the OPERATOR. bootstrap.sh generates the operator's signing key into a
#   throwaway store and DISCARDS it on exit: only the two ACCOUNT signing keys are
#   persisted to creds/. add-events-user.sh can add a user without the operator because
#   adding a user does NOT touch the account JWT — it is signed by the account's own
#   signing key, which IS persisted. Assigning JetStream limits DOES touch the account
#   JWT, so it needs a key that, by default, no longer exists anywhere.
#
#   Two ways out, and this script only handles the first:
#     1. You kept the operator's signing key seed somewhere outside creds/ (bootstrap.sh
#        never persists it). Pass it with --operator-key <path-to-seed>.
#     2. You did not (the default in this repository): re-bootstrap with
#        ./bootstrap.sh --force, which REISSUES EVERY CREDENTIAL and requires
#        redistributing them to api, core and the auth-callout.
#   See creds/README.md for the full procedure and its trade-offs.
#
# WHAT THIS DOES NOT DO
#   It does not create the JIKU_EVENTS stream (see create-events-stream.sh) and it does not
#   touch the AUTH account, which has no business with JetStream. One script, one
#   responsibility, same as add-events-user.sh.
#
# THE RESOLVER HERE IS MEMORY, SO THERE IS NO `nsc push`
#   nats-resolver.conf embeds the account JWTs directly (resolver: MEMORY). There is no
#   resolver endpoint to push to. "Re-pushing the JWTs" in this installation means:
#   rewrite nats-resolver.conf with the updated account JWT, then RESTART the nats
#   container — the server only reads resolver_preload at startup. The restart does not
#   invalidate any already-distributed .creds: those are signed by the account's signing
#   key, which does not change; only the account JWT itself is re-signed by the operator.

set -euo pipefail

cd "$(dirname "$0")"

OUT="creds"

FORCE=false
INSTANCE="${NATS_INSTANCE:-}"
OPERATOR_KEY=""
JS_STORAGE="${NATS_JS_STORAGE:-1G}"
JS_MEMORY="${NATS_JS_MEMORY:-256M}"
JS_STREAMS="${NATS_JS_STREAMS:-10}"
JS_CONSUMERS="${NATS_JS_CONSUMERS:-100}"

usage() {
  cat >&2 <<EOF
usage: $0 [--instance <name>] [--operator-key <path-to-seed>] [--force]
           [--js-storage <size>] [--js-memory <size>] [--js-streams <n>] [--js-consumer <n>]
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    --operator-key) OPERATOR_KEY="${2:-}"; shift 2 ;;
    --js-storage) JS_STORAGE="${2:-}"; shift 2 ;;
    --js-memory) JS_MEMORY="${2:-}"; shift 2 ;;
    --js-streams) JS_STREAMS="${2:-}"; shift 2 ;;
    --js-consumer) JS_CONSUMERS="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

# The instance defaults to what the deployment is actually configured with, same as
# add-events-user.sh, so the stream's future subject and this account's identity cannot
# drift apart by being typed twice.
if [[ -z "$INSTANCE" && -f ../.env ]]; then
  INSTANCE=$(grep -E '^NATS_INSTANCE=' ../.env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
fi
INSTANCE="${INSTANCE:-dev}"

if [[ "$INSTANCE" == *.* || "$INSTANCE" == *'*'* || "$INSTANCE" == *'>'* ]]; then
  echo "error: the instance \"$INSTANCE\" has to be a single subject token: no dots, no wildcards." >&2
  exit 1
fi

if ! command -v nsc >/dev/null 2>&1; then
  echo "error: nsc is missing. Install it with:" >&2
  echo "  curl -sf https://binaries.nats.dev/nats-io/nsc/v2@latest | sh" >&2
  exit 1
fi

if ! nsc edit account --help 2>&1 | grep -q -- '--js-disk-storage'; then
  echo "error: the installed nsc does not support --js-disk-storage on 'edit account'." >&2
  echo "Check 'nsc edit account --help' and update the flag names in this script." >&2
  exit 1
fi

for f in "$OUT/nats-resolver.conf" "$OUT/app-account.pub" "$OUT/app-account.sk.seed"; do
  [[ -f "$f" ]] || {
    echo "error: $f is missing. Generate the identity first: ./bootstrap.sh" >&2
    exit 1
  }
done

APP_PUB=$(cat "$OUT/app-account.pub")

# Same pattern as add-events-user.sh: rebuild a throwaway nsc context from what is already
# in creds/, locating the account BY PUBKEY rather than by the name in the comment (the
# name is a bootstrap variable, the comment is cosmetic).
STORE="$(mktemp -d)"
trap 'rm -rf "$STORE"' EXIT
export NSC_HOME="$STORE"
NSC="nsc --data-dir $STORE/store --config-dir $STORE/config --keystore-dir $STORE/keys"

awk '$1 == "operator:" { print $2; exit }' "$OUT/nats-resolver.conf" > "$STORE/operator.jwt"
awk -v k="$APP_PUB:" '$1 == k { print $2; exit }' "$OUT/nats-resolver.conf" > "$STORE/app.jwt"

[[ -s "$STORE/operator.jwt" ]] || { echo "error: no operator JWT in $OUT/nats-resolver.conf" >&2; exit 1; }
[[ -s "$STORE/app.jwt" ]] || {
  echo "error: account $APP_PUB is not in $OUT/nats-resolver.conf." >&2
  echo "app-account.pub and the resolver disagree: they are not from the same bootstrap." >&2
  exit 1
}

echo "==> rebuilding the nsc context"
$NSC add operator --url "$STORE/operator.jwt" >/dev/null
$NSC import account --file "$STORE/app.jwt" >/dev/null

ACCOUNT=$($NSC describe account --field name 2>/dev/null | tr -d '"')

# The account signing key's seed goes back into the keystore, same layout add-events-user.sh
# uses, so nsc can re-sign the account's user JWTs if it ever needs to. It is NOT what signs
# the account JWT itself — that needs the OPERATOR's signing key, checked next.
SK=$($NSC describe account --name "$ACCOUNT" --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
[[ -n "$SK" ]] || { echo "error: account $ACCOUNT declares no signing key" >&2; exit 1; }
mkdir -p "$STORE/keys/keys/A/${SK:1:2}"
cp "$OUT/app-account.sk.seed" "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"
chmod 600 "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"

# THE BLOCKING CHECK: does the operator's signing key exist? Without it, `nsc edit account`
# cannot re-sign the account JWT with the new limits, and would otherwise fail with a raw
# nsc error that names a key instead of explaining the actual problem.
OP_SK=$($NSC describe operator --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
if [[ -n "$OPERATOR_KEY" ]]; then
  [[ -f "$OPERATOR_KEY" ]] || { echo "error: --operator-key file not found: $OPERATOR_KEY" >&2; exit 1; }
  mkdir -p "$STORE/keys/keys/O/${OP_SK:1:2}"
  cp "$OPERATOR_KEY" "$STORE/keys/keys/O/${OP_SK:1:2}/$OP_SK.nk"
  chmod 600 "$STORE/keys/keys/O/${OP_SK:1:2}/$OP_SK.nk"
fi

if [[ ! -f "$STORE/keys/keys/O/${OP_SK:1:2}/$OP_SK.nk" ]]; then
  echo "error: the operator signing key is not available, and assigning JetStream limits needs it." >&2
  echo "" >&2
  echo "JetStream storage and memory limits live in the ACCOUNT JWT, and an account JWT is" >&2
  echo "signed by the OPERATOR. bootstrap.sh generates the operator signing key in a throwaway" >&2
  echo "store and discards it: only the two ACCOUNT signing keys are persisted to creds/." >&2
  echo "" >&2
  echo "That is why add-events-user.sh works without it and this script cannot: adding a user" >&2
  echo "does not touch the account JWT, assigning JetStream limits does." >&2
  echo "" >&2
  echo "Two ways out:" >&2
  echo "  1. You kept the operator key: pass it with --operator-key <path-to-seed>." >&2
  echo "  2. You did not (the default): re-bootstrap the identity with" >&2
  echo "     ./bootstrap.sh --force   — which REISSUES EVERY CREDENTIAL and requires" >&2
  echo "     redistributing them to api, core and the auth-callout." >&2
  echo "" >&2
  echo "See creds/README.md, section on enabling JetStream on an existing installation." >&2
  exit 1
fi

# Idempotency: if the account already has these limits, do nothing unless --force.
CURRENT_DISK=$($NSC describe account --name "$ACCOUNT" --field 'nats.limits.disk_storage' 2>/dev/null | tr -d '"')
# "null" means the account has no JetStream limits section at all (the JWT predates any
# --js-* edit). "0" or "-1" would mean it has one but disabled/unlimited disk. Only a
# positive number means limits are already assigned.
if [[ "$CURRENT_DISK" != "null" && -n "$CURRENT_DISK" && "$CURRENT_DISK" != "0" && "$FORCE" != true ]]; then
  echo "error: account $ACCOUNT already has JetStream disk storage assigned ($CURRENT_DISK bytes)." >&2
  echo "Run with --force to overwrite the limits." >&2
  exit 1
fi

echo "==> granting JetStream limits to $ACCOUNT (storage=$JS_STORAGE memory=$JS_MEMORY streams=$JS_STREAMS consumers=$JS_CONSUMERS)"
$NSC edit account --name "$ACCOUNT" \
  --js-disk-storage "$JS_STORAGE" \
  --js-mem-storage "$JS_MEMORY" \
  --js-streams "$JS_STREAMS" \
  --js-consumer "$JS_CONSUMERS" >/dev/null

echo "==> rewriting the $ACCOUNT line in $OUT/nats-resolver.conf"
# NOT a full `nsc generate config`: this store was reconstructed with only the APP
# account's JWT imported (the same trick add-events-user.sh uses), so a full regeneration
# would silently DROP the AUTH and SYS accounts from resolver_preload — confirmed while
# implementing this script. Editing surgically just the APP account's line, keyed by its
# pubkey, is what preserves the other two untouched.
cp "$OUT/nats-resolver.conf" "$OUT/nats-resolver.conf.bak"
NEW_JWT=$($NSC describe account --name "$ACCOUNT" --raw 2>/dev/null)
[[ -n "$NEW_JWT" ]] || { echo "error: could not read back the updated account JWT from nsc" >&2; exit 1; }
# Preserve the original line's leading whitespace ($0 minus $1 minus the space before it)
# so the file's formatting stays identical apart from the JWT itself.
awk -v k="$APP_PUB:" -v jwt="$NEW_JWT" '
  $1 == k {
    indent = $0; sub(k".*", "", indent)
    print indent k, jwt; next
  }
  { print }
' "$OUT/nats-resolver.conf.bak" > "$OUT/nats-resolver.conf.new"
mv "$OUT/nats-resolver.conf.new" "$OUT/nats-resolver.conf"
chmod 644 "$OUT/nats-resolver.conf"

echo
echo "Done. $ACCOUNT now has JetStream limits, and $OUT/nats-resolver.conf was rewritten"
echo "(backup at $OUT/nats-resolver.conf.bak)."
echo
echo "The resolver is MEMORY: the server only reads resolver_preload at startup, so this"
echo "does NOT take effect until you restart the nats container:"
echo "  docker compose restart nats"
echo
echo "This does NOT invalidate any already-distributed credential: the .creds files are"
echo "signed by the account's signing key, which did not change — only the account JWT"
echo "itself was re-signed by the operator."
echo
echo "Next: create the stream with ./create-events-stream.sh"
