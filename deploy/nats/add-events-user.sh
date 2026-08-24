#!/usr/bin/env bash
#
# Mints `callout-events`: the user the auth-callout publishes authentication events with.
#
# WHY IT IS NOT PART OF bootstrap.sh's ONE-SHOT RUN
#   bootstrap.sh generates the whole identity and refuses to run twice, because regenerating
#   it invalidates every credential already distributed. This user, on the other hand, has to
#   be addable to an installation that ALREADY EXISTS — the events feature arrived after the
#   bus was deployed.
#
#   It can, because adding a user does NOT touch the account JWT: a user JWT is signed by the
#   ACCOUNT's signing key, whose seed bootstrap.sh persisted as creds/app-account.sk.seed.
#   Nothing in creds/ is rewritten, nats-resolver.conf does not change, and no credential
#   already handed out stops working. bootstrap.sh calls this script at the end so a fresh
#   installation gets the user too.
#
# WHICH ACCOUNT, AND WHY IT IS NOT THE CALLOUT'S OWN
#   GESTION, the APP account — the one clients land in. The callout's own connection lives in
#   GESTION_AUTH, and accounts are isolated subject namespaces: an event published there would
#   be visible to nobody. That is why this is a SECOND connection with its own credential.
#
# THE PERMISSIONS ARE COUPLED TO CALLOUT_EVENTS_STREAM, AND THE COUPLING IS INVISIBLE
#   The callout's stream setting selects the DELIVERY MODE, not just a name:
#
#     unset  the event is an ordinary core NATS message. Nothing to ack, so the publisher
#            never subscribes — which is what makes `--deny-sub '>'` below correct.
#     set    the event is published to JetStream and the publisher WAITS FOR THE ACK. That
#            needs two permissions this user does NOT have: pub on
#            `$JS.API.STREAM.INFO.<stream>` (the startup check) and sub on `_INBOX.>` (the
#            ack comes back there).
#
#   So this credential and a configured stream are INCOMPATIBLE: the callout would fail at
#   startup with "JetStream did not answer about the stream" — a denied request gets no
#   responder, not a refusal, so the message names the stream rather than the permission.
#   If you move to acked events, widen this user AND create the stream. See the callout's
#   docs/events.md.
#
# THE SUBJECT IS LITERAL HERE AND A PATTERN THERE
#   The callout is configured with `{{instance}}.events.auth` and expands it per event. A
#   permission cannot be expanded: it is baked into the JWT. So the instance has to be the
#   SAME on both sides, and mismatching them fails as an asynchronous permissions violation
#   in the log — never as a refused connection.

set -euo pipefail

cd "$(dirname "$0")"

OUT="creds"
USER_NAME="callout-events"
CREDS_FILE="$OUT/$USER_NAME.creds"

FORCE=false
INSTANCE="${NATS_INSTANCE:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    *) echo "usage: $0 [--instance <name>] [--force]" >&2; exit 1 ;;
  esac
done

# The instance defaults to what the deployment is actually configured with, so the permission
# and CALLOUT_INSTANCE cannot drift apart by being typed twice.
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

for f in "$OUT/nats-resolver.conf" "$OUT/app-account.pub" "$OUT/app-account.sk.seed"; do
  [[ -f "$f" ]] || {
    echo "error: $f is missing. Generate the identity first: ./bootstrap.sh" >&2
    exit 1
  }
done

if [[ -f "$CREDS_FILE" ]] && [[ "$FORCE" != true ]]; then
  echo "error: $CREDS_FILE already exists." >&2
  echo "" >&2
  echo "Reissuing it replaces the credential the callout is using; restart the callout after." >&2
  echo "If that is what you want, run:  $0 --force" >&2
  exit 1
fi

APP_PUB=$(cat "$OUT/app-account.pub")

# The operator and the account JWTs are BOTH inside nats-resolver.conf — it is the mem-resolver
# the server is preloaded with, so it is the one place where the current, operator-signed
# account JWT is guaranteed to be the one in effect.
#
# The account is located BY PUBKEY rather than by the name in the comment above it: the name is
# a bootstrap variable (NATS_APP_ACCOUNT) and the comment is cosmetic, while app-account.pub is
# the same value the callout is configured with.
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

# The operator is imported WITHOUT its seed, which bootstrap.sh discarded with its throwaway
# store. That is enough: a user is signed by the account, and the operator JWT is only here so
# nsc has the context it needs to hold an account.
echo "==> rebuilding the nsc context"
$NSC add operator --url "$STORE/operator.jwt" >/dev/null
$NSC import account --file "$STORE/app.jwt" >/dev/null

ACCOUNT=$($NSC describe account --field name 2>/dev/null | tr -d '"')

# The signing key's seed goes back into the keystore under the layout nsc expects, which is the
# same one bootstrap.sh reads it out of. nsc signs with it and never sees the account's root key
# — which bootstrap.sh discarded too.
SK=$($NSC describe account --name "$ACCOUNT" --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
[[ -n "$SK" ]] || { echo "error: account $ACCOUNT declares no signing key" >&2; exit 1; }
mkdir -p "$STORE/keys/keys/A/${SK:1:2}"
cp "$OUT/app-account.sk.seed" "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"
chmod 600 "$STORE/keys/keys/A/${SK:1:2}/$SK.nk"

echo "==> user $USER_NAME on account $ACCOUNT (instance $INSTANCE)"
[[ "$FORCE" == true ]] && $NSC delete user --account "$ACCOUNT" --name "$USER_NAME" >/dev/null 2>&1 || true

# One publish and nothing else. No subscribe at all: in core mode the publisher never waits for
# anything, so a subscription it cannot use is authority it should not carry.
if ! $NSC add user --account "$ACCOUNT" --name "$USER_NAME" \
     --allow-pub "$INSTANCE.events.auth" \
     --deny-sub '>' >/dev/null 2>"$STORE/err"; then
  echo "error: nsc could not add the user:" >&2
  sed 's/^/  /' "$STORE/err" >&2
  echo "" >&2
  echo "If it names the signing key, $OUT/app-account.sk.seed does not belong to the account" >&2
  echo "in $OUT/nats-resolver.conf — the two are from different bootstraps." >&2
  exit 1
fi

$NSC generate creds --account "$ACCOUNT" --name "$USER_NAME" > "$CREDS_FILE"
chmod 600 "$CREDS_FILE"

echo
echo "Wrote $OUT/$USER_NAME.creds (publishes $INSTANCE.events.auth, subscribes to nothing)."
echo
echo "The callout picks it up with, in its environment:"
echo "  CALLOUT_EVENTS_SUBJECT=$INSTANCE.events.auth"
echo "  CALLOUT_EVENTS_CREDS=/etc/nats-creds/$USER_NAME.creds"
echo
echo "The compose files already carry both (the subject as \${NATS_INSTANCE}.events.auth)."
echo
echo "Nothing else in $OUT/ changed: no credential already distributed was invalidated."
