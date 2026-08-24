#!/usr/bin/env bash
#
# Generates the NATS identity the server needs in operator mode.
#
# Operator mode is a requirement of the auth-callout: authorisation is decided with
# account-signed JWTs, and that is what lets the callout issue a different User JWT per
# connection. A server in classic `authorization {}` mode cannot do it.
#
# Produces, in creds/:
#   nats-resolver.conf       operator, system account and account JWTs (included by nats-server.conf)
#   sentinel-client.creds    what api and core connect with
#   sentinel-handler.creds   what the auth-callout connects with
#   app-account.{pub,sk.seed}    APP account: signs the User JWTs the callout issues
#   auth-account.{pub,sk.seed}   AUTH account: signs the authorization_response
#   callout-xkey.{pub,seed}      XKey (curve25519) that decrypts the auth requests
#   callout-events.creds     what the callout publishes authentication events with
#   callout-env.sh           path contract for the callout
#
# Requires `nsc` (https://github.com/nats-io/nsc).
#
# IDEMPOTENT BUT NOT REPEATABLE: regenerating the identity invalidates already-distributed
# credentials and forces reissuing them. Run it ONCE per installation. If creds/ already has
# content, the script refuses to continue unless you pass --force.

set -euo pipefail

cd "$(dirname "$0")"

OPERATOR="${NATS_OPERATOR_NAME:-gestion}"
APP_ACCOUNT="${NATS_APP_ACCOUNT:-GESTION}"
AUTH_ACCOUNT="${NATS_AUTH_ACCOUNT:-GESTION_AUTH}"
OUT="creds"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

if ! command -v nsc >/dev/null 2>&1; then
  echo "error: nsc is missing. Install it with:" >&2
  echo "  curl -sf https://binaries.nats.dev/nats-io/nsc/v2@latest | sh" >&2
  exit 1
fi

# Only the README should be versioned; anything else is already-generated identity.
if [[ -f "$OUT/nats-resolver.conf" ]] && [[ "$FORCE" != true ]]; then
  echo "error: $OUT/ already holds a generated identity." >&2
  echo "" >&2
  echo "Regenerating it invalidates already-distributed credentials and forces reissuing" >&2
  echo "them on every service. If that is what you want, run:  $0 --force" >&2
  exit 1
fi

# nsc works against its own store. We use an ephemeral, local one so as not to touch the
# user's or depend on its prior state.
STORE="$(mktemp -d)"
trap 'rm -rf "$STORE"' EXIT
export NSC_HOME="$STORE"
NSC="nsc --data-dir $STORE/store --config-dir $STORE/config --keystore-dir $STORE/keys"

mkdir -p "$OUT"

# With --force it is regenerated from scratch: `nsc generate config` does not overwrite, so
# the previous content has to be cleaned. The README is preserved, being the only versioned
# file.
if [[ "$FORCE" == true ]]; then
  find "$OUT" -mindepth 1 ! -name 'README.md' -delete
fi

echo "==> operator $OPERATOR"
$NSC add operator --name "$OPERATOR" --sys >/dev/null
# With its own signing key: the operator does not sign accounts with its root key.
$NSC edit operator --sk generate >/dev/null

echo "==> account $APP_ACCOUNT (the services')"
$NSC add account --name "$APP_ACCOUNT" >/dev/null
$NSC edit account --name "$APP_ACCOUNT" --sk generate >/dev/null

echo "==> account $AUTH_ACCOUNT (the callout's)"
$NSC add account --name "$AUTH_ACCOUNT" >/dev/null
$NSC edit account --name "$AUTH_ACCOUNT" --sk generate >/dev/null

echo "==> sentinels"
# BOTH sentinels live in the AUTH account, and what differs between them is whether they are
# declared in `--auth-user`:
#
#   sentinel-handler  IT IS: the callout connects with it and the server authorises it
#                     directly, because an authorisation service cannot authorise itself.
#   sentinel-client   IT IS NOT: connecting with it TRIGGERS the callout, which mints a User
#                     JWT into the APP account according to the token's role.
#
# The client denies everything on its own, so it grants nothing by itself: all real access
# comes from the JWT the callout issues. That is why it is safe to distribute to the
# services.
$NSC add user --account "$AUTH_ACCOUNT" --name sentinel-handler >/dev/null
$NSC add user --account "$AUTH_ACCOUNT" --name sentinel-client \
  --deny-pub '>' --deny-sub '>' >/dev/null

echo "==> callout xkey"
# Curve25519: with this key the callout decrypts the authorisation requests.
# `nsc generate nkey --curve` prints both lines: seed (SX...) and public (X...).
XKEY_OUT=$(nsc generate nkey --curve 2>/dev/null)
XKEY_SEED=$(printf '%s\n' "$XKEY_OUT" | grep -E '^SX' | head -1)
XKEY_PUB=$(printf '%s\n' "$XKEY_OUT" | grep -E '^X' | head -1)
if [[ -z "$XKEY_SEED" || -z "$XKEY_PUB" ]]; then
  echo "error: could not generate the callout xkey" >&2
  exit 1
fi
printf '%s\n' "$XKEY_SEED" > "$OUT/callout-xkey.seed"
printf '%s\n' "$XKEY_PUB"  > "$OUT/callout-xkey.pub"

echo "==> declaring the auth callout on $AUTH_ACCOUNT"
HANDLER_PUB=$($NSC describe user --account "$AUTH_ACCOUNT" --name sentinel-handler --field sub 2>/dev/null | tr -d '"')
APP_PUB=$($NSC describe account --name "$APP_ACCOUNT" --field sub 2>/dev/null | tr -d '"')
$NSC edit authcallout --account "$AUTH_ACCOUNT" \
  --auth-user "$HANDLER_PUB" \
  --allowed-account "$APP_PUB" \
  --curve "$XKEY_PUB" >/dev/null

echo "==> exporting"
$NSC generate config --mem-resolver --config-file "$OUT/nats-resolver.conf" >/dev/null
$NSC generate creds --account "$AUTH_ACCOUNT" --name sentinel-client  > "$OUT/sentinel-client.creds"
$NSC generate creds --account "$AUTH_ACCOUNT" --name sentinel-handler > "$OUT/sentinel-handler.creds"

# Two different things per account, and confusing them breaks startup:
#
#   *.pub      the ACCOUNT's pubkey. It is the IssuerAccount claim of the User JWT the
#              callout mints, and it has to match what was declared in --allowed-account. If
#              the signing key goes here, the server rejects it with "not permitted as valid
#              account option for auth callout".
#   *.sk.seed  the signing key's SEED. That is what the callout signs with.
AUTH_PUB=$($NSC describe account --name "$AUTH_ACCOUNT" --field sub 2>/dev/null | tr -d '"')
printf '%s\n' "$APP_PUB"  > "$OUT/app-account.pub"
printf '%s\n' "$AUTH_PUB" > "$OUT/auth-account.pub"

for pair in "$APP_ACCOUNT:app-account" "$AUTH_ACCOUNT:auth-account"; do
  acct="${pair%%:*}"; base="${pair##*:}"
  sk=$($NSC describe account --name "$acct" --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
  cp "$STORE/keys/keys/A/${sk:1:2}/$sk.nk" "$OUT/$base.sk.seed"
done

cat > "$OUT/callout-env.sh" <<'ENVEOF'
# callout-env.sh — GENERATED by bootstrap.sh. DO NOT COMMIT.
# Paths relative to nats/. The variables point at FILES; the binary accepts either the path
# or the literal seed.
export GESTION_HANDLER_CREDS="${GESTION_NATS_DIR:-.}/creds/sentinel-handler.creds"
export GESTION_APP_ACCOUNT_SK_SEED="${GESTION_NATS_DIR:-.}/creds/app-account.sk.seed"
export GESTION_APP_ACCOUNT_PUB="${GESTION_NATS_DIR:-.}/creds/app-account.pub"
export GESTION_AUTH_ACCOUNT_SK_SEED="${GESTION_NATS_DIR:-.}/creds/auth-account.sk.seed"
export GESTION_XKEY_SEED="${GESTION_NATS_DIR:-.}/creds/callout-xkey.seed"
ENVEOF

# Secret material: seeds and creds with restrictive permissions.
chmod 600 "$OUT"/*.creds "$OUT"/*.seed 2>/dev/null || true
chmod 644 "$OUT"/*.pub "$OUT/callout-env.sh" "$OUT/nats-resolver.conf" 2>/dev/null || true

# The events publisher's user, in the APP account. It lives in its own script because it has to
# be addable to an installation that already exists — the events feature arrived after the bus
# was deployed — and this one refuses to run twice. Adding a user does not touch the account
# JWT, so that script needs nothing this one has not already written to creds/.
echo "==> events publisher user"
./add-events-user.sh

echo
echo "Done. Generated in deploy/nats/$OUT/:"
ls -1 "$OUT" | grep -v '^README.md$' | sed 's/^/  /'
echo
echo "None of this is versioned (except the README). Keep a safe copy: regenerating it"
echo "forces reissuing the credentials of every service."
