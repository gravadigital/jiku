#!/usr/bin/env bash
#
# bus-inspect.sh — mirar qué pasa en el bus.
#
#   ./bus-inspect.sh status     conexiones, suscripciones y contadores
#   ./bus-inspect.sh tail       sigue los comandos en vivo (api -> core)
#   ./bus-inspect.sh logs       los comandos que ya procesó core
#   ./bus-inspect.sh send <comando> <json>    publica un comando a mano
#
# Ejemplos:
#   ./bus-inspect.sh tail
#   ./bus-inspect.sh send clients.new '{"name":"Prueba"}'
#
# POR QUÉ NO ALCANZA CON `nats sub`
#   Los permisos que mintea el auth-callout son cerrados: `internal-app` solo publica y
#   `core` solo escucha su endpoint. Nadie puede suscribirse al tráfico ajeno, que es
#   justamente lo que protege el bus. Para espiar en vivo hay que conectarse con las
#   creds del sentinel de la cuenta de sistema, que es lo que hace `tail`.

set -euo pipefail
cd "$(dirname "$0")"

MONITOR="${NATS_MONITOR_URL:-http://localhost:8222}"
NETWORK="${NATS_DOCKER_NETWORK:-jiku-local_jiku}"
NATS_URL="${NATS_INTERNAL_URL:-nats://nats:4222}"

nats_box() {
  docker run --rm -i --network "$NETWORK" \
    -v "$PWD/nats/creds:/creds:ro" \
    natsio/nats-box:latest "$@"
}

case "${1:-status}" in
  status)
    echo "=== conexiones ==="
    curl -s "$MONITOR/connz" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  total: {d['num_connections']}\")
for c in d.get('connections', []):
    print(f\"  {c.get('name','?'):22} in={c.get('in_msgs'):<6} out={c.get('out_msgs'):<6} subs={c.get('subscriptions')}\")
"
    echo
    echo "=== subjects del protocolo (sin los internos de NATS) ==="
    curl -s "$MONITOR/subsz?subs=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rows = [s for s in d.get('subscriptions_list', [])
        if not s.get('subject','').startswith(('\$SYS', '\$JS'))]
for s in rows:
    print(f\"  {s.get('subject'):45} msgs={s.get('msgs')}\")
" || true
    ;;

  tail)
    # Un observador necesita un service user con el rol `bus-observer` en Zitadel
    # (ver nats/auth-callout/templates/observer.yaml). Sin eso, la forma de ver el
    # tráfico es el log de core, que imprime cada comando que atiende.
    echo "siguiendo los comandos que atiende core  (ctrl-c para salir)"
    echo
    docker logs -f jiku-local-core 2>&1 | grep --line-buffered -E "\[cmd\]|dispatch"
    ;;

  logs)
    echo "=== comandos que procesó core ==="
    docker logs jiku-local-core 2>&1 | grep -E "\[cmd\]|dispatch\]|comandos registrados|bus\]" | tail -30
    echo
    echo "=== errores que devolvió la api al publicar ==="
    docker logs jiku-local-api 2>&1 | grep -E "\[bus\]" | tail -10
    ;;

  send)
    COMMAND="${2:?uso: $0 send <comando> <json>}"
    PAYLOAD="${3:-\{\}}"
    # La key sale del .env (ver service-user-key.sh), así que no hace falta ningún
    # archivo suelto en el repo.
    [[ -f .env ]] && { set -a; . ./.env; set +a; }
    [[ -n "${API_SERVICE_USER_KEY_B64:-}" ]] || {
      echo "falta API_SERVICE_USER_KEY_B64 en deploy/.env — ver ./service-user-key.sh" >&2
      exit 1
    }
    KEY_TMP=$(mktemp); trap 'rm -f "$KEY_TMP"' EXIT
    base64 -d <<<"$API_SERVICE_USER_KEY_B64" > "$KEY_TMP"
    TOKEN=$(ZITADEL_ISSUER_URL="${GESTION_ZITADEL_ISSUER_URL:?falta GESTION_ZITADEL_ISSUER_URL}" \
            ZITADEL_PROJECT_ID="${GESTION_ZITADEL_PROJECT_ID:-}" \
            ./zitadel-token.sh "$KEY_TMP")

    # El subject lleva el user id CRUDO y el inbox su HASH. Los dos salen de la misma key,
    # porque tienen que coincidir con lo que el callout deriva del token; hardcodearlos
    # haría que el permiso no cubra el subject y la request muera por timeout.
    USER_ID=$(jq -r .userId "$KEY_TMP")
    INBOX_HASH=$(python3 -c '
import base64, hashlib, sys
digest = hashlib.sha256(sys.argv[1].encode()).digest()
print(base64.b32encode(digest).decode().rstrip("=")[:16].lower())' "$USER_ID")

    nats_box nats --server "$NATS_URL" \
      --creds /creds/sentinel-client.creds \
      --token "$TOKEN" \
      --inbox-prefix "_INBOX.${INBOX_HASH}" \
      request "${NATS_INSTANCE:-dev}.${USER_ID}.${NATS_SERVICE_NAME:-gestion}.${NATS_PROTOCOL_VERSION:-v1}.${COMMAND}" "$PAYLOAD"
    ;;

  *)
    echo "uso: $0 [status|tail|logs|send <comando> <json>]" >&2
    exit 1
    ;;
esac
