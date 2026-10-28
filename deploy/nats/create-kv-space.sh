#!/usr/bin/env bash
#
# Creates (or verifies) the JIKU_KV key-value bucket: the per-identity key-value space of the
# jiku SDKs (jiku-go `Client.KV`, jiku-ts `client.kv()`). Connectors keep their state in it —
# jiku-email-tickets stores its ticket and thread maps there. Without the bucket the SDK refuses
# to bind (ErrNoBucket) and a connector that uses it does not start, so it is versioned
# infrastructure and not a one-off `nats kv add` nobody can reproduce.
#
# ONE BUCKET FOR EVERY IDENTITY AND INSTANCE. Keys are `<instance>.<user id>.<key>`: the
# instance and the identity are segments of the KEY, not of the bucket, so this script does not
# resolve NATS_INSTANCE either. What keeps one identity out of another's keys is the
# auth-callout grant, scoped to `{{instance}}.{{user_id}}.>`.
#
# Contract (jiku-go docs/kv.md): history 1, no TTL, direct reads allowed, file storage,
# 1 replica. No TTL because connectors store maps they need to keep, not a cache. allow_direct
# is REQUIRED: without it the SDK's Get goes to $JS.API.STREAM.MSG.GET, which takes the key in
# the body and cannot be confined to one identity, so the SDK refuses the bucket. The script
# compares those six fields of the stream config, not the output of `nats kv info` (whose format
# belongs to the CLI, not to the server).
#
# WHICH CREDENTIAL THIS CONNECTS WITH
#   Neither sentinel-client.creds (denies everything, triggers the callout) nor
#   callout-events.creds (only publishes events.auth) can create or inspect a stream. This
#   script mints a throwaway administrative user in the APP account ($JS.API.> pub/sub and
#   its own inbox), the same way create-modules-kv.sh does, and discards it on exit.
#
# WHAT THIS SCRIPT DOES NOT DO
#   It grants nobody anything. Who may use the bucket lives in auth-callout/templates/:
#   `internal-app` and `docs` read and write only their own `<instance>.<user id>.>` keys.
#   Limits (max value size, max bucket size) are left unset; they are shared by every identity.

set -euo pipefail

cd "$(dirname "$0")"

OUT="creds"
BUCKET="JIKU_KV"
STREAM_NAME="KV_$BUCKET"
STREAM_SUBJECT="\$KV.$BUCKET.>"
NETWORK="${NATS_DOCKER_NETWORK:-jiku-local_jiku}"
NATS_URL="${NATS_INTERNAL_URL:-nats://nats:4222}"

FORCE=false

usage() {
  echo "usage: ./create-kv-space.sh [--force]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    *) usage ;;
  esac
done

if ! command -v nsc >/dev/null 2>&1; then
  echo "error: nsc is missing. Install it with:" >&2
  echo "  curl -sf https://binaries.nats.dev/nats-io/nsc/v2@latest | sh" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is missing. It runs the nats client via natsio/nats-box, no local install needed." >&2
  exit 1
fi

for f in "$OUT/nats-resolver.conf" "$OUT/app-account.pub" "$OUT/app-account.sk.seed"; do
  [[ -f "$f" ]] || {
    echo "error: $f is missing. Generate the identity first: ./bootstrap.sh" >&2
    exit 1
  }
done

nats_box() {
  docker run --rm -i --network "$NETWORK" \
    -v "$PWD/creds:/creds:ro" \
    -v "$TMP_CREDS:/tmp-creds:ro" \
    natsio/nats-box:latest "$@"
}

APP_PUB=$(cat "$OUT/app-account.pub")

STORE="$(mktemp -d)"
TMP_CREDS="$(mktemp -d)"
USER_NAME="kv-space-admin-$$"
ACCOUNT=""

# The throwaway user is account-side state (unlike the ephemeral store, which vanishes
# with the rm below). Deleting it from the trap covers the early `exit 0` paths too.
cleanup() {
  if [[ -n "$ACCOUNT" ]]; then
    $NSC delete user --account "$ACCOUNT" --name "$USER_NAME" >/dev/null 2>&1 || true
  fi
  rm -rf "$STORE" "$TMP_CREDS"
}
trap cleanup EXIT

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

SK=$($NSC describe account --name "$ACCOUNT" --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
[[ -n "$SK" ]] || { echo "error: account $ACCOUNT declares no signing key" >&2; exit 1; }
mkdir -p "$STORE/keys/keys/A/${SK:1:2}"
cp "$OUT/app-account.sk.seed" "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"
chmod 600 "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"

# A KV bucket is a stream: it needs the same JetStream limits. An account without them
# mints users fine and only fails later, when the bucket is created; name the real cause.
JS_DISK=$($NSC describe account --name "$ACCOUNT" --field 'nats.limits.disk_storage' 2>/dev/null | tr -d '"')
if [[ "$JS_DISK" == "null" || "$JS_DISK" == "0" || -z "$JS_DISK" ]]; then
  echo "error: account $ACCOUNT has no JetStream storage limit assigned." >&2
  echo "JetStream may be enabled on the server, but this account cannot create streams" >&2
  echo "(a KV bucket is one) without --js-disk-storage set. Run ./enable-jetstream.sh (or," >&2
  echo "for a fresh installation, re-run ./bootstrap.sh) before creating the bucket." >&2
  exit 1
fi

echo "==> minting a throwaway administrative user for this run only"
# Needs BOTH $JS.API.> and sub on _INBOX.> (a denied request gets no responder rather than
# a refusal, so a missing inbox shows up as "context deadline exceeded").
$NSC add user --account "$ACCOUNT" --name "$USER_NAME" \
  --allow-pub '$JS.API.>' \
  --allow-sub '$JS.API.>,_INBOX.>' >/dev/null

$NSC generate creds --account "$ACCOUNT" --name "$USER_NAME" > "$TMP_CREDS/admin.creds"
chmod 600 "$TMP_CREDS/admin.creds"

nats_cli() {
  nats_box nats --server "$NATS_URL" --creds /tmp-creds/admin.creds "$@"
}

# Reads one field of the stream config out of a `stream info --json` document.
cfg() {
  echo "$1" | python3 -c "import sys,json; v=json.load(sys.stdin)['config']['$2']; print(','.join(v) if isinstance(v, list) else str(v).lower() if isinstance(v, bool) else v)"
}

# ------------------------------------------------------------------------------------
# Idempotency: if the bucket already exists, compare it against the declared contract
# instead of blindly re-creating or silently doing nothing.
# ------------------------------------------------------------------------------------
EXISTING=$(nats_cli stream info "$STREAM_NAME" --json 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  DRIFT=""
  check() { # field expected
    local got
    got=$(cfg "$EXISTING" "$1")
    [[ "$got" == "$2" ]] || DRIFT+="  $1: got $got, expected $2\n"
  }
  check subjects "$STREAM_SUBJECT"
  check max_msgs_per_subject 1
  check max_age 0
  check allow_direct true
  check storage file
  check num_replicas 1

  if [[ -z "$DRIFT" ]]; then
    echo "$BUCKET already exists with the expected parameters. Nothing to do."
    exit 0
  fi

  if [[ "$FORCE" != true ]]; then
    echo "error: $BUCKET already exists but its parameters differ from the contract:" >&2
    echo -e "$DRIFT" >&2
    echo "Run with --force to update it, or investigate why it drifted." >&2
    exit 1
  fi

  echo "==> updating $BUCKET (--force, parameters differed)"
  # Subjects, storage and replicas of an existing stream are not editable in place; if those
  # drifted, the CLI says so and the bucket has to be recreated by hand.
  nats_cli stream edit "$STREAM_NAME" \
    --max-msgs-per-subject 1 \
    --max-age 0 \
    --allow-direct \
    --force >/dev/null
else
  echo "==> creating $BUCKET"
  # Every parameter of the contract is named explicitly (no TTL = no --ttl), so a future
  # NATS default change cannot alter this bucket unnoticed.
  nats_cli kv add "$BUCKET" \
    --history 1 \
    --storage file \
    --replicas 1 >/dev/null
  # `kv add` enables direct reads in recent servers, but the contract does not depend on a
  # default: make it explicit, and the verification below fails if it did not stick.
  nats_cli stream edit "$STREAM_NAME" --allow-direct --force >/dev/null
fi

echo "==> verifying"
FINAL=$(nats_cli stream info "$STREAM_NAME" --json)
echo "$FINAL" | python3 -c "
import sys, json
d = json.load(sys.stdin)['config']
print(f\"  name={d['name']} max_msgs_per_subject={d['max_msgs_per_subject']} max_age={d['max_age']} allow_direct={d.get('allow_direct', False)} storage={d['storage']} num_replicas={d['num_replicas']}\")
"

if [[ "$(cfg "$FINAL" allow_direct)" != "true" ]]; then
  echo "error: $BUCKET does not have allow_direct enabled: the SDK refuses to bind it (ErrNoBucket)." >&2
  exit 1
fi

echo
echo "Done. $BUCKET exists."
