#!/usr/bin/env bash
#
# zitadel-token.sh — access token de un service user (machine user) de Zitadel.
#
#   ./zitadel-token.sh <ruta-a-la-key.json>            imprime el token
#   ./zitadel-token.sh --check <ruta-a-la-key.json>    lo genera y lo diagnostica
#
# Usa el flujo JWT-profile (private_key_jwt): firma localmente un assertion con la
# private key del JSON y lo intercambia por un access token. Es el formato que entrega
# Zitadel en el machine user: Keys -> New -> JSON.
#
# EL TOKEN TIENE QUE SER JWT
#   El auth-callout valida por JWKS: verifica la firma localmente, sin llamar a Zitadel.
#   Un token opaco no tiene firma que verificar, así que lo rechaza y la conexión al bus
#   falla con `Authorization Violation`.
#
#   Por defecto Zitadel emite tokens OPACOS para machine users. Se cambia por usuario:
#     UI:  el machine user -> Access Token Type = JWT
#     API: PUT /management/v1/users/{userId}/machine
#          {"accessTokenType":"ACCESS_TOKEN_TYPE_JWT"}
#
#   `--check` detecta exactamente este caso y lo dice.
#
# LOS ROLES NO VIENEN SOLOS
#   Un token de machine user solo incluye los roles si se pide el scope
#   `urn:zitadel:iam:org:projects:roles` — el genérico, no el de un proyecto puntual.
#   Sin roles el callout no matchea ninguna regla y rechaza la conexión.

set -euo pipefail

ISSUER="${ZITADEL_ISSUER_URL:?falta ZITADEL_ISSUER_URL}"
ISSUER="${ISSUER%/}"
PROJECT_ID="${ZITADEL_PROJECT_ID:-}"

CHECK=0
[[ "${1:-}" == "--check" ]] && { CHECK=1; shift; }

KEY_FILE="${1:?uso: $0 [--check] <service-user.json>}"
[[ -f "$KEY_FILE" ]] || { echo "no existe: $KEY_FILE" >&2; exit 1; }

for bin in jq curl openssl; do
  command -v "$bin" >/dev/null || { echo "falta $bin" >&2; exit 1; }
done

JSON=$(cat "$KEY_FILE")
jq -e '.keyId and .key and .userId' <<<"$JSON" >/dev/null 2>&1 || {
  echo "ERROR: el JSON no tiene keyId/key/userId." >&2
  echo "Exportá la key completa desde el machine user (Keys -> New -> JSON)." >&2
  exit 1
}

# --- assertion firmado con la private key ---------------------------------------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

KEY_ID=$(jq -r .keyId <<<"$JSON")
USER_ID=$(jq -r .userId <<<"$JSON")

PRIV=$(mktemp); chmod 600 "$PRIV"
trap 'rm -f "$PRIV"' EXIT
jq -r .key <<<"$JSON" > "$PRIV"

NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","kid":"%s"}' "$KEY_ID" | b64url)
# `aud` es el issuer: el assertion va dirigido a Zitadel, no al proyecto.
PAYLOAD=$(printf '{"iss":"%s","sub":"%s","aud":"%s","iat":%d,"exp":%d}' \
  "$USER_ID" "$USER_ID" "$ISSUER" "$NOW" "$((NOW + 300))" | b64url)
SIGNATURE=$(printf '%s.%s' "$HEADER" "$PAYLOAD" \
  | openssl dgst -sha256 -sign "$PRIV" | b64url)

# --- intercambio ----------------------------------------------------------------------
SCOPE="openid profile urn:zitadel:iam:org:projects:roles"
[[ -n "$PROJECT_ID" ]] && SCOPE="$SCOPE urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud"

RESPONSE=$(curl -sS -X POST "$ISSUER/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "scope=$SCOPE" \
  --data-urlencode "assertion=${HEADER}.${PAYLOAD}.${SIGNATURE}")

TOKEN=$(jq -r '.access_token // empty' <<<"$RESPONSE")
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Zitadel no devolvió access_token:" >&2
  jq . <<<"$RESPONSE" >&2 2>/dev/null || echo "$RESPONSE" >&2
  exit 1
fi

if [[ "$CHECK" -eq 0 ]]; then
  echo "$TOKEN"
  exit 0
fi

# --- diagnóstico ----------------------------------------------------------------------
PARTS=$(awk -F. '{print NF}' <<<"$TOKEN")
echo "usuario   $USER_ID"
echo "issuer    $ISSUER"

if [[ "$PARTS" -ne 3 ]]; then
  echo "formato   OPACO  <-- el callout lo va a RECHAZAR"
  echo
  echo "Zitadel emite tokens opacos por defecto. Para este machine user hay que"
  echo "cambiarlo a JWT:"
  echo
  echo "  UI:  machine user -> Access Token Type = JWT"
  echo "  API: PUT $ISSUER/management/v1/users/$USER_ID/machine"
  echo "       {\"accessTokenType\":\"ACCESS_TOKEN_TYPE_JWT\"}"
  echo "       (con un token que tenga permisos de administración)"
else
  echo "formato   JWT  (ok)"
  PAYLOAD_JSON=$(cut -d. -f2 <<<"$TOKEN" | tr '_-' '/+' \
    | awk '{ while (length($0) % 4) $0 = $0 "="; print }' | openssl base64 -d -A 2>/dev/null)
  echo "expira    $(date -d "@$(jq -r .exp <<<"$PAYLOAD_JSON")" '+%H:%M:%S')"
fi

# Los roles se leen de /userinfo: sirve igual para token opaco y para JWT.
# Solo el claim de Zitadel (`...:project:<id>:roles`), que es un objeto {rol: {...}}.
# Puede haber otros claims que terminen en "roles" con otra forma.
ROLES=$(curl -sS "$ISSUER/oidc/v1/userinfo" -H "Authorization: Bearer $TOKEN" \
  | jq -r '[to_entries[]
             | select(.key | startswith("urn:zitadel:iam:org:project:"))
             | select(.key | endswith(":roles"))
             | select(.value | type == "object")
             | .value | keys[]] | unique | join(", ")' 2>/dev/null)

if [[ -z "$ROLES" || "$ROLES" == "null" ]]; then
  echo "roles     NINGUNO  <-- el callout no va a matchear ninguna regla"
  echo "          Asignale el rol al machine user en el proyecto."
else
  echo "roles     $ROLES"
fi

[[ "$PARTS" -eq 3 ]] || exit 1
