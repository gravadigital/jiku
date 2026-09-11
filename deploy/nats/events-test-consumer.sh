#!/usr/bin/env bash
#
# Lanza el consumidor de prueba de eventos de dominio (S-067, CA-3): mintea una credencial
# DESCARTABLE en la cuenta APP, con EXACTAMENTE los mismos tres permisos que declara
# `auth-callout/templates/connector.yaml` (D-6), y corre `tests/tools/events-test-consumer.ts`
# de `core` con ella. Al salir (por timeout, o cortado con Ctrl-C), borra la credencial.
#
# ES UNA HERRAMIENTA DE VERIFICACIÓN, NO UN CONECTOR PRODUCTIVO. El conector real se
# desarrolla FUERA de este repositorio (REQ-014): esto sirve para comprobar que el molde de
# permisos de la Task 1 alcanza, y que el transporte entrega lo que el contrato promete —
# las dos cosas que un doble de test (`FakeEventPublisher`) no puede probar.
#
# POR QUÉ ES EL MISMO PATRÓN DE `create-events-stream.sh`: reconstruye el contexto de `nsc`
# desde `creds/` (sin operator key: mintear un usuario no toca el JWT de la cuenta), corre el
# CLI de `nats` — acá, en realidad, el propio consumidor TypeScript — con una credencial que
# se borra al final. La diferencia es que ese script mintea un ADMIN para crear el stream;
# este mintea un LECTOR para consumirlo, con permisos mucho más angostos.
#
# LOS TRES PERMISOS, Y LA ÚNICA DIFERENCIA CON `connector.yaml`:
#   --allow-sub "$INSTANCE.events.$EVENTS_VERSION.>"   igual que la plantilla
#   --allow-pub '$JS.API.>'                            igual que la plantilla
#   --allow-sub '_INBOX.>'                              LA PLANTILLA usa '_INBOX.{{user_id_hash}}.>'
#                                                        (por RÉPLICA); acá alcanza con '_INBOX.>'
#                                                        porque este usuario es de UN SOLO USO,
#                                                        nadie más comparte esta cuenta al mismo
#                                                        tiempo. La diferencia está comentada acá
#                                                        y en el encabezado de `connector.yaml`.
#
# Si este script funciona con esos tres permisos, el molde de la Task 1 es suficiente y
# correcto; si le falta algo, al molde le falta lo mismo (D-6).

set -euo pipefail

cd "$(dirname "$0")"

OUT="creds"
NETWORK="${NATS_DOCKER_NETWORK:-jiku-local_jiku}"
NATS_URL="${NATS_INTERNAL_URL:-nats://nats:4222}"
CORE_DIR="../../core"

DURABLE="events-test-consumer"
FROM_START=false
TIMEOUT="60"
INSTANCE="${NATS_INSTANCE:-}"

usage() {
  cat >&2 <<'EOF'
uso: events-test-consumer.sh [opciones]

Consumidor de prueba del stream de eventos de dominio JIKU_EVENTS (S-067, CA-3). Mintea una
credencial DESCARTABLE con los tres permisos del molde `auth-callout/templates/connector.yaml`
(sub sobre la versión entera de eventos, pub sobre $JS.API.>, sub sobre su propio inbox) y corre
el consumidor de `core/tests/tools/events-test-consumer.ts` con ella. La borra al salir, también
si se corta con Ctrl-C.

Es una HERRAMIENTA DE VERIFICACIÓN, NO el conector productivo — ese se desarrolla fuera de Jiku.

Opciones:
  --instance <name>     default: NATS_INSTANCE del .env, si no "dev"
  --durable <nombre>    default: events-test-consumer
  --from-start          pide TODO lo que quede en el stream, no solo eventos nuevos
  --timeout <segundos>  default: 60
  --help                imprime esta ayuda y termina (exit 0)

Receta del experimento de CA-5 (pérdida por retención tras 7 días) — DESTRUCTIVO, SOLO en un
entorno de prueba, nunca en producción:

  # 1) bajar la retención del stream a 10 segundos (afecta TODO el stream, no un mensaje):
  docker run --rm -i --network jiku-local_jiku -v "$PWD/creds:/creds:ro" \
    natsio/nats-box:latest nats --server nats://nats:4222 --creds /creds/<admin>.creds \
    stream update JIKU_EVENTS --max-age 10s --force

  # 2) publicar uno o más comandos que emitan eventos (por la web, o con bus-inspect.sh send)

  # 3) esperar más de 10 segundos

  # 4) correr este script con --from-start: los eventos vencidos NO van a llegar, y NO HAY
  #    FORMA DE SABER CUÁLES FUERON — comportamiento DECLARADO de core-events.yaml, no un bug.
  ./events-test-consumer.sh --from-start

  # 5) restaurar el max_age del stream a 7 días (repetir el paso 1 con --max-age 7d)
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help) usage ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    --durable) DURABLE="${2:-}"; shift 2 ;;
    --from-start) FROM_START=true; shift ;;
    --timeout) TIMEOUT="${2:-}"; shift 2 ;;
    *) echo "opción desconocida: $1" >&2; usage ;;
  esac
done

if [[ -z "$INSTANCE" && -f ../.env ]]; then
  INSTANCE=$(grep -E '^NATS_INSTANCE=' ../.env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
fi
INSTANCE="${INSTANCE:-dev}"

EVENTS_VERSION="${NATS_EVENTS_VERSION:-v1}"

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

# Preflight del stream (mismo chequeo que `deploy/local.sh:108-119`): si no existe, el mensaje
# nombra el script que lo crea, en vez de dejar que el consumidor TypeScript falle con un error
# crudo de JetStream (TS-37).
if ! curl -s http://localhost:8222/jsz?streams=1 2>/dev/null | grep -q '"name": *"JIKU_EVENTS"'; then
  echo "error: el stream JIKU_EVENTS no existe todavía." >&2
  echo "Creálo primero: ./create-events-stream.sh" >&2
  exit 1
fi

APP_PUB=$(cat "$OUT/app-account.pub")

STORE="$(mktemp -d)"
TMP_CREDS="$(mktemp -d)"
USER_NAME="events-test-consumer-$$"
ACCOUNT=""

# Limpieza: borra el usuario descartable y los directorios temporales, TAMBIÉN si nos cortan
# con Ctrl-C (TS-42) — el mismo patrón de `create-events-stream.sh`.
cleanup() {
  if [[ -n "$ACCOUNT" ]]; then
    NSC="nsc --data-dir $STORE/store --config-dir $STORE/config --keystore-dir $STORE/keys"
    $NSC delete user --account "$ACCOUNT" --name "$USER_NAME" >/dev/null 2>&1 || true
  fi
  rm -rf "$STORE" "$TMP_CREDS"
}
trap cleanup EXIT INT TERM

export NSC_HOME="$STORE"
NSC="nsc --data-dir $STORE/store --config-dir $STORE/config --keystore-dir $STORE/keys"

awk '$1 == "operator:" { print $2; exit }' "$OUT/nats-resolver.conf" > "$STORE/operator.jwt"
awk -v k="$APP_PUB:" '$1 == k { print $2; exit }' "$OUT/nats-resolver.conf" > "$STORE/app.jwt"

[[ -s "$STORE/operator.jwt" ]] || { echo "error: no operator JWT in $OUT/nats-resolver.conf" >&2; exit 1; }
[[ -s "$STORE/app.jwt" ]] || {
  echo "error: account $APP_PUB is not in $OUT/nats-resolver.conf." >&2
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

echo "==> minting a throwaway consumer user for this run only"
# Los MISMOS tres permisos que `auth-callout/templates/connector.yaml` (D-6). La única
# diferencia es el inbox: acá alcanza '_INBOX.>' porque el usuario es de un solo uso y nadie
# más lo comparte; la plantilla usa '_INBOX.{{user_id_hash}}.>' porque es por RÉPLICA.
$NSC add user --account "$ACCOUNT" --name "$USER_NAME" \
  --allow-sub "$INSTANCE.events.$EVENTS_VERSION.>,_INBOX.>" \
  --allow-pub '$JS.API.>' >/dev/null

$NSC generate creds --account "$ACCOUNT" --name "$USER_NAME" > "$TMP_CREDS/consumer.creds"
chmod 600 "$TMP_CREDS/consumer.creds"

echo "==> starting the test consumer (durable=$DURABLE, timeout=${TIMEOUT}s)"

CONSUMER_ARGS=(--nats-url "$NATS_URL" --creds "$TMP_CREDS/consumer.creds" --durable "$DURABLE" --timeout "$TIMEOUT")
if [[ "$FROM_START" == true ]]; then
  CONSUMER_ARGS+=(--from-start)
fi

# `cd "$(dirname "$0")"` de arriba ya nos deja en `deploy/nats/`; el paquete `core` resuelve
# desde ACÁ, no desde el cwd de quien invoca este script.
(
  cd "$CORE_DIR"
  NATS_INSTANCE="$INSTANCE" NATS_EVENTS_VERSION="$EVENTS_VERSION" \
    npx ts-node tests/tools/events-test-consumer.ts "${CONSUMER_ARGS[@]}"
)
