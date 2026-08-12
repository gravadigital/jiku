#!/usr/bin/env bash
#
# zitadel-token.sh — access token for a Zitadel service user (machine user).
#
#   ./zitadel-token.sh <path-to-the-key.json>            prints the token
#   ./zitadel-token.sh --check <path-to-the-key.json>    generates and diagnoses it
#
# Uses the JWT-profile flow (private_key_jwt): signs an assertion locally with the private
# key from the JSON and exchanges it for an access token. That is the format Zitadel hands
# out on the machine user: Keys -> New -> JSON.
#
# THE TOKEN HAS TO BE A JWT
#   The auth-callout validates via JWKS: it verifies the signature locally, without calling
#   Zitadel. An opaque token has no signature to verify, so it is rejected and the bus
#   connection fails with `Authorization Violation`.
#
#   By default Zitadel issues OPAQUE tokens for machine users. It is changed per user:
#     UI:  the machine user -> Access Token Type = JWT
#     API: PUT /management/v1/users/{userId}/machine
#          {"accessTokenType":"ACCESS_TOKEN_TYPE_JWT"}
#
#   `--check` detects exactly this case and says so.
#
# ROLES DO NOT COME FOR FREE
#   A machine user token only includes the roles if the `urn:zitadel:iam:org:projects:roles`
#   scope is requested — the generic one, not the one for a specific project. With no roles
#   the callout matches no rule and rejects the connection.

set -euo pipefail

ISSUER="${ZITADEL_ISSUER_URL:?ZITADEL_ISSUER_URL is missing}"
ISSUER="${ISSUER%/}"
PROJECT_ID="${ZITADEL_PROJECT_ID:-}"

CHECK=0
[[ "${1:-}" == "--check" ]] && { CHECK=1; shift; }

KEY_FILE="${1:?usage: $0 [--check] <service-user.json>}"
[[ -f "$KEY_FILE" ]] || { echo "does not exist: $KEY_FILE" >&2; exit 1; }

for bin in jq curl openssl; do
  command -v "$bin" >/dev/null || { echo "$bin is missing" >&2; exit 1; }
done

JSON=$(cat "$KEY_FILE")
jq -e '.keyId and .key and .userId' <<<"$JSON" >/dev/null 2>&1 || {
  echo "ERROR: the JSON has no keyId/key/userId." >&2
  echo "Export the whole key from the machine user (Keys -> New -> JSON)." >&2
  exit 1
}

# --- assertion signed with the private key --------------------------------------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

KEY_ID=$(jq -r .keyId <<<"$JSON")
USER_ID=$(jq -r .userId <<<"$JSON")

PRIV=$(mktemp); chmod 600 "$PRIV"
trap 'rm -f "$PRIV"' EXIT
jq -r .key <<<"$JSON" > "$PRIV"

NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","kid":"%s"}' "$KEY_ID" | b64url)
# `aud` is the issuer: the assertion is addressed to Zitadel, not to the project.
PAYLOAD=$(printf '{"iss":"%s","sub":"%s","aud":"%s","iat":%d,"exp":%d}' \
  "$USER_ID" "$USER_ID" "$ISSUER" "$NOW" "$((NOW + 300))" | b64url)
SIGNATURE=$(printf '%s.%s' "$HEADER" "$PAYLOAD" \
  | openssl dgst -sha256 -sign "$PRIV" | b64url)

# --- exchange -------------------------------------------------------------------------
SCOPE="openid profile urn:zitadel:iam:org:projects:roles"
[[ -n "$PROJECT_ID" ]] && SCOPE="$SCOPE urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud"

RESPONSE=$(curl -sS -X POST "$ISSUER/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "scope=$SCOPE" \
  --data-urlencode "assertion=${HEADER}.${PAYLOAD}.${SIGNATURE}")

TOKEN=$(jq -r '.access_token // empty' <<<"$RESPONSE")
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Zitadel returned no access_token:" >&2
  jq . <<<"$RESPONSE" >&2 2>/dev/null || echo "$RESPONSE" >&2
  exit 1
fi

if [[ "$CHECK" -eq 0 ]]; then
  echo "$TOKEN"
  exit 0
fi

# --- diagnosis ------------------------------------------------------------------------
PARTS=$(awk -F. '{print NF}' <<<"$TOKEN")
echo "user      $USER_ID"
echo "issuer    $ISSUER"

if [[ "$PARTS" -ne 3 ]]; then
  echo "format    OPAQUE  <-- the callout will REJECT it"
  echo
  echo "Zitadel issues opaque tokens by default. For this machine user it has to be"
  echo "changed to JWT:"
  echo
  echo "  UI:  machine user -> Access Token Type = JWT"
  echo "  API: PUT $ISSUER/management/v1/users/$USER_ID/machine"
  echo "       {\"accessTokenType\":\"ACCESS_TOKEN_TYPE_JWT\"}"
  echo "       (with a token that has management permissions)"
else
  echo "format    JWT  (ok)"
  PAYLOAD_JSON=$(cut -d. -f2 <<<"$TOKEN" | tr '_-' '/+' \
    | awk '{ while (length($0) % 4) $0 = $0 "="; print }' | openssl base64 -d -A 2>/dev/null)
  echo "expires   $(date -d "@$(jq -r .exp <<<"$PAYLOAD_JSON")" '+%H:%M:%S')"
fi

# The roles are read from /userinfo: that works for both opaque tokens and JWTs.
# Only Zitadel's claim (`...:project:<id>:roles`), which is an object {role: {...}}.
# There may be other claims ending in "roles" with a different shape.
ROLES=$(curl -sS "$ISSUER/oidc/v1/userinfo" -H "Authorization: Bearer $TOKEN" \
  | jq -r '[to_entries[]
             | select(.key | startswith("urn:zitadel:iam:org:project:"))
             | select(.key | endswith(":roles"))
             | select(.value | type == "object")
             | .value | keys[]] | unique | join(", ")' 2>/dev/null)

if [[ -z "$ROLES" || "$ROLES" == "null" ]]; then
  echo "roles     NONE  <-- the callout will match no rule"
  echo "          Grant the role to the machine user on the project."
else
  echo "roles     $ROLES"
fi

[[ "$PARTS" -eq 3 ]] || exit 1
