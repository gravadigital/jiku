#!/usr/bin/env bash
#
# Genera la identidad de NATS que necesita el servidor en modo operator.
#
# El modo operator es un requisito del auth-callout: la autorización se decide con JWTs
# firmados por cuentas, y es lo que le permite al callout emitir un User JWT distinto por
# conexión. Un server en modo `authorization {}` clásico no puede hacerlo.
#
# Produce en creds/:
#   nats-resolver.conf       operator, system account y JWTs de cuenta (lo incluye nats-server.conf)
#   sentinel-client.creds    con lo que conectan api y core
#   sentinel-handler.creds   con lo que conecta el auth-callout
#   app-account.{pub,sk.seed}    cuenta APP: firma los User JWT que emite el callout
#   auth-account.{pub,sk.seed}   cuenta AUTH: firma el authorization_response
#   callout-xkey.{pub,seed}      XKey (curve25519) que desencripta los requests de auth
#   callout-env.sh           contrato de rutas para el callout
#
# Requiere `nsc` (https://github.com/nats-io/nsc).
#
# ES IDEMPOTENTE PERO NO REPETIBLE: regenerar la identidad invalida las credenciales ya
# distribuidas y obliga a reemitirlas. Se corre UNA VEZ por instalación. Si creds/ ya tiene
# contenido, el script se niega a seguir salvo que pases --force.

set -euo pipefail

cd "$(dirname "$0")"

OPERATOR="${NATS_OPERATOR_NAME:-gestion}"
APP_ACCOUNT="${NATS_APP_ACCOUNT:-GESTION}"
AUTH_ACCOUNT="${NATS_AUTH_ACCOUNT:-GESTION_AUTH}"
OUT="creds"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

if ! command -v nsc >/dev/null 2>&1; then
  echo "error: falta nsc. Instalalo con:" >&2
  echo "  curl -sf https://binaries.nats.dev/nats-io/nsc/v2@latest | sh" >&2
  exit 1
fi

# Solo el README debería estar versionado; cualquier otra cosa es identidad ya generada.
if [[ -f "$OUT/nats-resolver.conf" ]] && [[ "$FORCE" != true ]]; then
  echo "error: $OUT/ ya tiene una identidad generada." >&2
  echo "" >&2
  echo "Regenerarla invalida las credenciales ya distribuidas y obliga a reemitirlas en" >&2
  echo "todos los servicios. Si es lo que querés, corré:  $0 --force" >&2
  exit 1
fi

# nsc trabaja sobre su propio store. Usamos uno efímero y local para no tocar el del
# usuario ni depender de su estado previo.
STORE="$(mktemp -d)"
trap 'rm -rf "$STORE"' EXIT
export NSC_HOME="$STORE"
NSC="nsc --data-dir $STORE/store --config-dir $STORE/config --keystore-dir $STORE/keys"

mkdir -p "$OUT"

# Con --force se regenera desde cero: `nsc generate config` no sobrescribe, así que hay que
# limpiar lo anterior. Se preserva el README, que es lo único versionado.
if [[ "$FORCE" == true ]]; then
  find "$OUT" -mindepth 1 ! -name 'README.md' -delete
fi

echo "==> operator $OPERATOR"
$NSC add operator --name "$OPERATOR" --sys >/dev/null
# Con signing key propia: el operator no firma cuentas con su clave raíz.
$NSC edit operator --sk generate >/dev/null

echo "==> cuenta $APP_ACCOUNT (la de los servicios)"
$NSC add account --name "$APP_ACCOUNT" >/dev/null
$NSC edit account --name "$APP_ACCOUNT" --sk generate >/dev/null

echo "==> cuenta $AUTH_ACCOUNT (la del callout)"
$NSC add account --name "$AUTH_ACCOUNT" >/dev/null
$NSC edit account --name "$AUTH_ACCOUNT" --sk generate >/dev/null

echo "==> sentinelas"
# LOS DOS sentinelas viven en la cuenta AUTH, y la diferencia entre ellos es si están
# declarados en `--auth-user`:
#
#   sentinel-handler  SÍ está: el callout conecta con él y el server lo autoriza directo,
#                     porque un servicio de autorización no puede autorizarse a sí mismo.
#   sentinel-client   NO está: conectar con él DISPARA el callout, que mintea un User JWT
#                     hacia la cuenta APP según el rol del token.
#
# El client deniega todo por su cuenta, así que no concede nada por sí solo: todo el acceso
# real viene del JWT que emite el callout. Por eso es seguro distribuirlo a los servicios.
$NSC add user --account "$AUTH_ACCOUNT" --name sentinel-handler >/dev/null
$NSC add user --account "$AUTH_ACCOUNT" --name sentinel-client \
  --deny-pub '>' --deny-sub '>' >/dev/null

echo "==> xkey del callout"
# Curve25519: con esta clave el callout desencripta los requests de autorización.
# `nsc generate nkey --curve` imprime las dos líneas: seed (SX...) y pública (X...).
XKEY_OUT=$(nsc generate nkey --curve 2>/dev/null)
XKEY_SEED=$(printf '%s\n' "$XKEY_OUT" | grep -E '^SX' | head -1)
XKEY_PUB=$(printf '%s\n' "$XKEY_OUT" | grep -E '^X' | head -1)
if [[ -z "$XKEY_SEED" || -z "$XKEY_PUB" ]]; then
  echo "error: no se pudo generar la xkey del callout" >&2
  exit 1
fi
printf '%s\n' "$XKEY_SEED" > "$OUT/callout-xkey.seed"
printf '%s\n' "$XKEY_PUB"  > "$OUT/callout-xkey.pub"

echo "==> declarando el auth callout en $AUTH_ACCOUNT"
HANDLER_PUB=$($NSC describe user --account "$AUTH_ACCOUNT" --name sentinel-handler --field sub 2>/dev/null | tr -d '"')
APP_PUB=$($NSC describe account --name "$APP_ACCOUNT" --field sub 2>/dev/null | tr -d '"')
$NSC edit authcallout --account "$AUTH_ACCOUNT" \
  --auth-user "$HANDLER_PUB" \
  --allowed-account "$APP_PUB" \
  --curve "$XKEY_PUB" >/dev/null

echo "==> exportando"
$NSC generate config --mem-resolver --config-file "$OUT/nats-resolver.conf" >/dev/null
$NSC generate creds --account "$AUTH_ACCOUNT" --name sentinel-client  > "$OUT/sentinel-client.creds"
$NSC generate creds --account "$AUTH_ACCOUNT" --name sentinel-handler > "$OUT/sentinel-handler.creds"

# Dos cosas distintas por cuenta, y confundirlas rompe el arranque:
#
#   *.pub      la pubkey de la CUENTA. Es el claim IssuerAccount del User JWT que mintea el
#              callout, y tiene que coincidir con lo declarado en --allowed-account. Si acá
#              va la signing key, el server rechaza con "not permitted as valid account
#              option for auth callout".
#   *.sk.seed  la SEED de la signing key. Es con lo que el callout firma.
AUTH_PUB=$($NSC describe account --name "$AUTH_ACCOUNT" --field sub 2>/dev/null | tr -d '"')
printf '%s\n' "$APP_PUB"  > "$OUT/app-account.pub"
printf '%s\n' "$AUTH_PUB" > "$OUT/auth-account.pub"

for pair in "$APP_ACCOUNT:app-account" "$AUTH_ACCOUNT:auth-account"; do
  acct="${pair%%:*}"; base="${pair##*:}"
  sk=$($NSC describe account --name "$acct" --field 'nats.signing_keys[0]' 2>/dev/null | tr -d '"')
  cp "$STORE/keys/keys/A/${sk:1:2}/$sk.nk" "$OUT/$base.sk.seed"
done

cat > "$OUT/callout-env.sh" <<'ENVEOF'
# callout-env.sh — GENERADO por bootstrap.sh. NO COMMITEAR.
# Rutas relativas a nats/. Las variables apuntan a ARCHIVOS; el binario acepta tanto el
# path como la seed literal.
export GESTION_HANDLER_CREDS="${GESTION_NATS_DIR:-.}/creds/sentinel-handler.creds"
export GESTION_APP_ACCOUNT_SK_SEED="${GESTION_NATS_DIR:-.}/creds/app-account.sk.seed"
export GESTION_APP_ACCOUNT_PUB="${GESTION_NATS_DIR:-.}/creds/app-account.pub"
export GESTION_AUTH_ACCOUNT_SK_SEED="${GESTION_NATS_DIR:-.}/creds/auth-account.sk.seed"
export GESTION_XKEY_SEED="${GESTION_NATS_DIR:-.}/creds/callout-xkey.seed"
ENVEOF

# Material secreto: seeds y creds con permisos restrictivos.
chmod 600 "$OUT"/*.creds "$OUT"/*.seed 2>/dev/null || true
chmod 644 "$OUT"/*.pub "$OUT/callout-env.sh" "$OUT/nats-resolver.conf" 2>/dev/null || true

echo
echo "Listo. Generado en deploy/nats/$OUT/:"
ls -1 "$OUT" | grep -v '^README.md$' | sed 's/^/  /'
echo
echo "Nada de esto se versiona (salvo el README). Guardá una copia segura: regenerarlo"
echo "obliga a reemitir las credenciales de todos los servicios."
