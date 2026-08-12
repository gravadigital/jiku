#!/usr/bin/env bash
#
# service-user-key.sh — prepara la key de un service user para el `.env`.
#
#   ./service-user-key.sh api  ~/Descargas/api-su.json
#   ./service-user-key.sh core ~/Descargas/core-su.json
#
# Toma la key JSON que entrega Zitadel (machine user -> Keys -> New -> JSON), la
# codifica en base64 y la escribe en `.env` como API_SERVICE_USER_KEY_B64 o
# CORE_SERVICE_USER_KEY_B64.
#
# Va en base64 y no como JSON crudo porque la private key lleva saltos de línea
# escapados, que un `.env` no maneja bien.
#
# Antes de escribirla verifica que sirva: que el token sea un JWT (el auth-callout lo
# valida por JWKS y rechaza los opacos) y que traiga el rol que el servicio necesita.

set -euo pipefail
cd "$(dirname "$0")"

SERVICE="${1:-}"
KEY_FILE="${2:-}"

if [[ -z "$SERVICE" || -z "$KEY_FILE" ]]; then
  echo "uso: $0 <api|core> <ruta-a-la-key.json>" >&2
  exit 1
fi

case "$SERVICE" in
  api)  VAR=API_SERVICE_USER_KEY_B64;  EXPECTED_ROLE=internal-app ;;
  core) VAR=CORE_SERVICE_USER_KEY_B64; EXPECTED_ROLE=core ;;
  *)    echo "el servicio tiene que ser 'api' o 'core'" >&2; exit 1 ;;
esac

[[ -f "$KEY_FILE" ]] || { echo "no existe: $KEY_FILE" >&2; exit 1; }
[[ -f .env ]] || { echo "falta deploy/.env — copiá .env.dist y completalo" >&2; exit 1; }
set -a; . ./.env; set +a

command -v jq >/dev/null || { echo "falta jq" >&2; exit 1; }

jq -e '.keyId and .key and .userId' "$KEY_FILE" >/dev/null 2>&1 || {
  echo "ERROR: $KEY_FILE no parece una key de service user (falta keyId, key o userId)." >&2
  echo "Exportala desde el machine user: Keys -> New -> JSON." >&2
  exit 1
}

echo "==> verificando la key contra Zitadel"
if ! OUTPUT=$(ZITADEL_ISSUER_URL="${GESTION_ZITADEL_ISSUER_URL:?falta GESTION_ZITADEL_ISSUER_URL}" \
               ZITADEL_PROJECT_ID="${GESTION_ZITADEL_PROJECT_ID:-}" \
               ./zitadel-token.sh --check "$KEY_FILE" 2>&1); then
  echo "$OUTPUT" >&2
  exit 1
fi
echo "$OUTPUT" | sed 's/^/    /'

if ! grep -q "roles.*$EXPECTED_ROLE" <<<"$OUTPUT"; then
  echo >&2
  echo "ERROR: el service user de '$SERVICE' necesita el rol '$EXPECTED_ROLE'." >&2
  echo "       Asignáselo en Zitadel, sobre el proyecto de GESTION_ZITADEL_PROJECT_ID." >&2
  exit 1
fi

ENCODED=$(jq -c . "$KEY_FILE" | base64 -w0)

if grep -q "^${VAR}=" .env; then
  # Con `|` como separador: el base64 puede contener `/`.
  sed -i "s|^${VAR}=.*|${VAR}=${ENCODED}|" .env
else
  printf '\n%s=%s\n' "$VAR" "$ENCODED" >> .env
fi

echo
echo "listo: $VAR quedó en deploy/.env"
