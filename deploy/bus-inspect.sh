#!/usr/bin/env bash
#
# bus-inspect.sh — look at what is happening on the bus.
#
#   ./bus-inspect.sh status     connections, subscriptions and counters
#   ./bus-inspect.sh tail       follow the commands live (api -> core)
#   ./bus-inspect.sh logs       the commands core already processed
#   ./bus-inspect.sh send <command> <json>    publish a command by hand
#
# Examples:
#   ./bus-inspect.sh tail
#   ./bus-inspect.sh send clients.new '{"name":"Test"}'
#
# WHY `nats sub` IS NOT ENOUGH
#   The permissions the auth-callout mints are narrow: `internal-app` only publishes and
#   `core` only listens on its endpoint. Nobody can subscribe to someone else's traffic,
#   which is exactly what protects the bus. To watch live you have to connect with the
#   system account sentinel's creds, which is what `tail` does.

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
    echo "=== connections ==="
    curl -s "$MONITOR/connz" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  total: {d['num_connections']}\")
for c in d.get('connections', []):
    print(f\"  {c.get('name','?'):22} in={c.get('in_msgs'):<6} out={c.get('out_msgs'):<6} subs={c.get('subscriptions')}\")
"
    echo
    echo "=== protocol subjects (excluding NATS internals) ==="
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
    # An observer needs a service user with the `bus-observer` role in Zitadel (see
    # nats/auth-callout/templates/observer.yaml). Without that, the way to see the
    # traffic is core's log, which prints every command it serves.
    echo "following the commands core serves  (ctrl-c to quit)"
    echo
    docker logs -f jiku-local-core 2>&1 | grep --line-buffered -E "\[cmd\]|dispatch"
    ;;

  logs)
    echo "=== commands core processed ==="
    docker logs jiku-local-core 2>&1 | grep -E "\[cmd\]|dispatch\]|registered commands|bus\]" | tail -30
    echo
    echo "=== errors the api returned when publishing ==="
    docker logs jiku-local-api 2>&1 | grep -E "\[bus\]" | tail -10
    ;;

  send)
    COMMAND="${2:?usage: $0 send <command> <json>}"
    PAYLOAD="${3:-\{\}}"
    # The key comes from the .env (see service-user-key.sh), so no loose file is needed
    # in the repo.
    [[ -f .env ]] && { set -a; . ./.env; set +a; }
    [[ -n "${API_SERVICE_USER_KEY_B64:-}" ]] || {
      echo "API_SERVICE_USER_KEY_B64 is missing from deploy/.env — see ./service-user-key.sh" >&2
      exit 1
    }
    KEY_TMP=$(mktemp); trap 'rm -f "$KEY_TMP"' EXIT
    base64 -d <<<"$API_SERVICE_USER_KEY_B64" > "$KEY_TMP"
    TOKEN=$(ZITADEL_ISSUER_URL="${GESTION_ZITADEL_ISSUER_URL:?GESTION_ZITADEL_ISSUER_URL is missing}" \
            ZITADEL_PROJECT_ID="${GESTION_ZITADEL_PROJECT_ID:-}" \
            ./zitadel-token.sh "$KEY_TMP")

    # The subject carries the RAW user id and the inbox its HASH. Both come from the same
    # key, because they have to match what the callout derives from the token; hardcoding
    # them would leave the permission not covering the subject and the request would time
    # out.
    USER_ID=$(jq -r .userId "$KEY_TMP")
    INBOX_HASH=$(python3 -c '
import base64, hashlib, sys
digest = hashlib.sha256(sys.argv[1].encode()).digest()
print(base64.b32encode(digest).decode().rstrip("=")[:16].lower())' "$USER_ID")

    nats_box nats --server "$NATS_URL" \
      --creds /creds/sentinel-client.creds \
      --token "$TOKEN" \
      --inbox-prefix "_INBOX.${INBOX_HASH}" \
      request "${NATS_INSTANCE:-dev}.${USER_ID}.${NATS_COMMAND_SERVICE:-jiku-commands}.${NATS_PROTOCOL_VERSION:-v1}.${COMMAND}" "$PAYLOAD"
    ;;

  *)
    echo "usage: $0 [status|tail|logs|send <command> <json>]" >&2
    exit 1
    ;;
esac
