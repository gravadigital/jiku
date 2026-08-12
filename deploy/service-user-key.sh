#!/usr/bin/env bash
#
# service-user-key.sh — prepares a service user key for the `.env`.
#
#   ./service-user-key.sh api  ~/Downloads/api-su.json
#   ./service-user-key.sh core ~/Downloads/core-su.json
#
# Takes the JSON key Zitadel hands out (machine user -> Keys -> New -> JSON), encodes it
# in base64 and writes it into `.env` as API_SERVICE_USER_KEY_B64 or
# CORE_SERVICE_USER_KEY_B64.
#
# It goes in as base64 rather than raw JSON because the private key carries escaped
# newlines, which a `.env` does not handle well.
#
# Before writing it, it checks the key actually works: that the token is a JWT (the
# auth-callout validates it via JWKS and rejects opaque ones) and that it carries the role
# the service needs.

set -euo pipefail
cd "$(dirname "$0")"

SERVICE="${1:-}"
KEY_FILE="${2:-}"

if [[ -z "$SERVICE" || -z "$KEY_FILE" ]]; then
  echo "usage: $0 <api|core> <path-to-the-key.json>" >&2
  exit 1
fi

case "$SERVICE" in
  api)  VAR=API_SERVICE_USER_KEY_B64;  EXPECTED_ROLE=internal-app ;;
  core) VAR=CORE_SERVICE_USER_KEY_B64; EXPECTED_ROLE=core ;;
  *)    echo "the service has to be 'api' or 'core'" >&2; exit 1 ;;
esac

[[ -f "$KEY_FILE" ]] || { echo "does not exist: $KEY_FILE" >&2; exit 1; }
[[ -f .env ]] || { echo "deploy/.env is missing — copy .env.dist and fill it in" >&2; exit 1; }
set -a; . ./.env; set +a

command -v jq >/dev/null || { echo "jq is missing" >&2; exit 1; }

jq -e '.keyId and .key and .userId' "$KEY_FILE" >/dev/null 2>&1 || {
  echo "ERROR: $KEY_FILE does not look like a service user key (missing keyId, key or userId)." >&2
  echo "Export it from the machine user: Keys -> New -> JSON." >&2
  exit 1
}

echo "==> verifying the key against Zitadel"
if ! OUTPUT=$(ZITADEL_ISSUER_URL="${GESTION_ZITADEL_ISSUER_URL:?GESTION_ZITADEL_ISSUER_URL is missing}" \
               ZITADEL_PROJECT_ID="${GESTION_ZITADEL_PROJECT_ID:-}" \
               ./zitadel-token.sh --check "$KEY_FILE" 2>&1); then
  echo "$OUTPUT" >&2
  exit 1
fi
echo "$OUTPUT" | sed 's/^/    /'

if ! grep -q "roles.*$EXPECTED_ROLE" <<<"$OUTPUT"; then
  echo >&2
  echo "ERROR: the '$SERVICE' service user needs the '$EXPECTED_ROLE' role." >&2
  echo "       Grant it in Zitadel, on the GESTION_ZITADEL_PROJECT_ID project." >&2
  exit 1
fi

ENCODED=$(jq -c . "$KEY_FILE" | base64 -w0)

if grep -q "^${VAR}=" .env; then
  # `|` as the separator: the base64 can contain `/`.
  sed -i "s|^${VAR}=.*|${VAR}=${ENCODED}|" .env
else
  printf '\n%s=%s\n' "$VAR" "$ENCODED" >> .env
fi

echo
echo "done: $VAR is now in deploy/.env"
