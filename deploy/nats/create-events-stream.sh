#!/usr/bin/env bash
#
# Creates (or verifies) the JIKU_EVENTS stream: the persisted transport for the domain
# events REQ-014 introduces. This is what makes the stream versioned infrastructure
# instead of a `nats stream add` someone ran once and nobody can reproduce.
#
# THE VERSION SEGMENT IS NOT DECORATION, IT IS THE WHOLE OF CRITERION CA-4
#   Stream subject  {instance}.events.v1.>   -> dev.events.auth does NOT match. Correct.
#   Stream subject  {instance}.events.>      -> dev.events.auth DOES match, and the
#                                               auth-callout's event would be persisted
#                                               into the domain-events stream. That is
#                                               exactly what CA-4 forbids.
#
# The auth event is a THREE-SEGMENT subject with no version, on purpose: it is an event
# ABOUT an identity, not published BY it. See auth-callout/templates/core.yaml, which says
# so at length and warns against "correcting" it. So the version in OUR subject is what
# keeps the two namespaces apart.
#
# eventsStreamSubject() DOES NOT EXIST YET (S-062, the events contract, is parallel to
# this story). The subject here is LITERAL, built from NATS_INSTANCE, not from
# @jiku/nats-protocol. When S-062 lands its helper, it will produce the same subject this
# script already creates the stream with.
#
# WHICH CREDENTIAL THIS CONNECTS WITH
#   Neither sentinel-client.creds (denies everything, triggers the callout, which mints
#   permissions with no $JS.API.> at all) nor callout-events.creds (only publishes
#   events.auth, denies sub) can create or inspect a stream. This script mints a
#   throwaway administrative user in the APP account — $JS.API.> pub/sub and its own
#   inbox — the same way add-events-user.sh mints callout-events, and discards it when
#   done. It needs no operator key: minting a user does not touch the account JWT.
#
# WHAT THIS SCRIPT DOES NOT DO
#   It does not grant anyone `pub.allow` on the stream's subject or on $JS.API.> for
#   ongoing use — that is S-063 (core, the publisher) and S-067 (a connector template).
#   After this script runs, the stream exists and NOBODY can publish to it or consume it.
#   That is the correct order: infrastructure first, permission alongside the code that
#   uses it.

set -euo pipefail

cd "$(dirname "$0")"

OUT="creds"
STREAM_NAME="JIKU_EVENTS"
NETWORK="${NATS_DOCKER_NETWORK:-jiku-local_jiku}"
NATS_URL="${NATS_INTERNAL_URL:-nats://nats:4222}"

FORCE=false
INSTANCE="${NATS_INSTANCE:-}"

usage() {
  echo "usage: $0 [--instance <name>] [--force]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

# Same resolution as add-events-user.sh: the instance defaults to what the deployment is
# actually configured with, so the stream's subject cannot drift from what the rest of the
# bus uses.
if [[ -z "$INSTANCE" && -f ../.env ]]; then
  INSTANCE=$(grep -E '^NATS_INSTANCE=' ../.env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
fi
INSTANCE="${INSTANCE:-dev}"

if [[ "$INSTANCE" == *.* || "$INSTANCE" == *'*'* || "$INSTANCE" == *'>'* ]]; then
  echo "error: the instance \"$INSTANCE\" has to be a single subject token: no dots, no wildcards." >&2
  exit 1
fi

EVENTS_VERSION="${NATS_EVENTS_VERSION:-v1}"

# THE VERSION SEGMENT IS NOT DECORATION, IT IS THE WHOLE OF CRITERION CA-4
#   Stream subject  {instance}.events.v1.>   -> dev.events.auth does NOT match. Correct.
#   Stream subject  {instance}.events.>      -> dev.events.auth DOES match, and the
#                                               auth-callout's event would be persisted
#                                               into the domain-events stream. That is
#                                               exactly what CA-4 forbids.
[[ "$EVENTS_VERSION" =~ ^v[0-9]+$ ]] || {
  echo "error: the events version must look like v1, v2... got \"$EVENTS_VERSION\"." >&2
  echo "An empty or malformed version would produce the subject $INSTANCE.events.>," >&2
  echo "which swallows $INSTANCE.events.auth into the stream. Refusing." >&2
  exit 1
}

STREAM_SUBJECT="$INSTANCE.events.$EVENTS_VERSION.>"

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

# ------------------------------------------------------------------------------------
# Mint a throwaway administrative user in the APP account, scoped to $JS.API.> and its
# own inbox. Same trick as add-events-user.sh: reconstruct nsc's context from creds/,
# using the account's signing key (persisted) — no operator key needed, because minting
# a user does not touch the account JWT.
# ------------------------------------------------------------------------------------
APP_PUB=$(cat "$OUT/app-account.pub")

STORE="$(mktemp -d)"
TMP_CREDS="$(mktemp -d)"
trap 'rm -rf "$STORE" "$TMP_CREDS"' EXIT
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

# Account without JetStream limits assigned looks exactly like this from here: the user
# mints fine (minting a user needs no JetStream capacity), and the failure only shows up
# later, when the stream is actually created. Distinguish it explicitly so the error
# message names the right cause.
JS_DISK=$($NSC describe account --name "$ACCOUNT" --field 'nats.limits.disk_storage' 2>/dev/null | tr -d '"')
if [[ "$JS_DISK" == "null" || "$JS_DISK" == "0" || -z "$JS_DISK" ]]; then
  echo "error: account $ACCOUNT has no JetStream storage limit assigned." >&2
  echo "JetStream may be enabled on the server, but this account cannot create streams" >&2
  echo "without --js-disk-storage set. Run ./enable-jetstream.sh (or, for a fresh" >&2
  echo "installation, re-run ./bootstrap.sh) before creating the stream." >&2
  exit 1
fi

echo "==> minting a throwaway administrative user for this run only"
USER_NAME="events-stream-admin-$$"
# Needs BOTH $JS.API.> (to call the JetStream admin API) and sub on _INBOX.> (the nats
# CLI replies land in a random inbox subject, not on $JS.API.> itself) — without the
# second, every call times out with "context deadline exceeded" instead of a permissions
# error, because a denied request gets no responder rather than a refusal.
$NSC add user --account "$ACCOUNT" --name "$USER_NAME" \
  --allow-pub '$JS.API.>' \
  --allow-sub '$JS.API.>,_INBOX.>' >/dev/null

$NSC generate creds --account "$ACCOUNT" --name "$USER_NAME" > "$TMP_CREDS/admin.creds"
chmod 600 "$TMP_CREDS/admin.creds"

# ------------------------------------------------------------------------------------
# Idempotency: if the stream already exists, compare it against the declared contract
# instead of blindly re-creating or silently doing nothing.
# ------------------------------------------------------------------------------------
EXISTING=$(nats_box nats --server "$NATS_URL" --creds /tmp-creds/admin.creds \
  stream info "$STREAM_NAME" --json 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  CUR_SUBJECTS=$(echo "$EXISTING" | python3 -c "import sys,json; print(','.join(json.load(sys.stdin)['config']['subjects']))")
  CUR_RETENTION=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['config']['retention'])")
  CUR_MAX_AGE=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['config']['max_age'])")
  CUR_STORAGE=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['config']['storage'])")

  EXPECTED_MAX_AGE=604800000000000 # 7 days in nanoseconds

  DRIFT=""
  [[ "$CUR_SUBJECTS" == "$STREAM_SUBJECT" ]] || DRIFT+="  subjects: got [$CUR_SUBJECTS], expected [$STREAM_SUBJECT]\n"
  [[ "$CUR_RETENTION" == "limits" ]] || DRIFT+="  retention: got $CUR_RETENTION, expected limits\n"
  [[ "$CUR_MAX_AGE" == "$EXPECTED_MAX_AGE" ]] || DRIFT+="  max_age: got $CUR_MAX_AGE, expected $EXPECTED_MAX_AGE\n"
  [[ "$CUR_STORAGE" == "file" ]] || DRIFT+="  storage: got $CUR_STORAGE, expected file\n"

  if [[ -z "$DRIFT" ]]; then
    echo "$STREAM_NAME already exists with the expected parameters. Nothing to do."
    echo -e "$EXISTING" | python3 -c "import sys,json; d=json.load(sys.stdin)['config']; print(f\"  name={d['name']} subjects={d['subjects']} retention={d['retention']} max_age={d['max_age']} storage={d['storage']}\")"
    exit 0
  fi

  if [[ "$FORCE" != true ]]; then
    echo "error: $STREAM_NAME already exists but its parameters differ from the contract:" >&2
    echo -e "$DRIFT" >&2
    echo "Run with --force to update it, or investigate why it drifted." >&2
    exit 1
  fi

  echo "==> updating $STREAM_NAME (--force, parameters differed)"
  nats_box nats --server "$NATS_URL" --creds /tmp-creds/admin.creds \
    stream update "$STREAM_NAME" \
    --subjects "$STREAM_SUBJECT" \
    --retention limits \
    --max-age 7d \
    --storage file \
    --replicas 1 \
    --discard old \
    --dupe-window 2m \
    --max-msgs=-1 \
    --max-bytes=-1 \
    --max-msg-size=-1 \
    --defaults >/dev/null
else
  echo "==> creating $STREAM_NAME on subject $STREAM_SUBJECT"
  # --defaults avoids the interactive wizard, which would hang the script. Every
  # parameter that matters to the contract is named explicitly rather than accepted
  # silently, so a future NATS default change cannot alter this stream unnoticed.
  #
  # v2 and beyond: when the events version increments, the NEW subject
  # ({instance}.events.v2.>) is ADDED to this SAME stream's subjects — a stream per
  # version would split retention and ordering for no benefit. Consumers separate by
  # filter_subject instead.
  nats_box nats --server "$NATS_URL" --creds /tmp-creds/admin.creds \
    stream add "$STREAM_NAME" \
    --subjects "$STREAM_SUBJECT" \
    --retention limits \
    --max-age 7d \
    --storage file \
    --replicas 1 \
    --discard old \
    --dupe-window 2m \
    --max-msgs=-1 \
    --max-bytes=-1 \
    --max-msg-size=-1 \
    --defaults >/dev/null
fi

echo "==> verifying"
nats_box nats --server "$NATS_URL" --creds /tmp-creds/admin.creds \
  stream info "$STREAM_NAME" --json | python3 -c "
import sys, json
d = json.load(sys.stdin)['config']
print(f\"  name={d['name']}\")
print(f\"  subjects={d['subjects']}\")
print(f\"  retention={d['retention']}\")
print(f\"  max_age={d['max_age']}\")
print(f\"  storage={d['storage']}\")
"

echo
echo "Done. $STREAM_NAME exists on $STREAM_SUBJECT."
echo
echo "Nobody has permission to publish to it or consume it yet — that arrives with the"
echo 'code that needs it (core'"'"'s pub.allow and $JS.API.> in S-063, a connector template'
echo "in S-067). This is expected, not a defect: infrastructure first, permission with"
echo "the code that uses it."

# The throwaway user is account-side state (unlike the ephemeral store, which vanished
# with the trap above); delete it so it does not accumulate across runs.
$NSC delete user --account "$ACCOUNT" --name "$USER_NAME" >/dev/null 2>&1 || true
