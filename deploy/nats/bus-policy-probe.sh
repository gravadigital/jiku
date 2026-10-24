#!/usr/bin/env bash
#
# Runs the bus policy probe (S-075, Task 6): connects to the REAL bus as a real identity
# (sentinel + Zitadel token, like the services do) and checks the allow/deny matrix of one
# profile, using the NATS server log as the oracle: it counts `Violation` lines before and
# after the run.
#
#   ./bus-policy-probe.sh --profile <docs|connector|person-internal|person-external> --key <service-user.json>
#
# Needs the local stack up (`../local.sh up`), the JIKU_MODULES bucket created, and the
# auth-callout restarted after editing templates (it reads them at startup). The service
# user keys live OUTSIDE this repository; they are passed by --key, never copied.
# Exit 0 only if every probe matched its expectation AND the server logged exactly the
# violations the profile expects to deny.

set -euo pipefail

cd "$(dirname "$0")"

CORE_DIR="../../core"
NATS_CONTAINER="${NATS_CONTAINER:-jiku-local-nats}"
PROFILE=""
KEY=""

usage() {
  echo "usage: $0 --profile <docs|connector|person-internal|person-external> --key <service-user.json>" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --key) KEY="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[[ -n "$PROFILE" && -n "$KEY" ]] || usage
[[ -f "$KEY" ]] || { echo "error: $KEY does not exist." >&2; exit 1; }
[[ -f ../.env ]] || { echo "error: deploy/.env is missing." >&2; exit 1; }

env_value() { grep -E "^$1=" ../.env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'; }

count_violations() {
  docker logs "$NATS_CONTAINER" 2>&1 | grep -cE 'Publish Violation|Subscription Violation' || true
}

KEY_ABS="$(realpath "$KEY")"
CREDS_ABS="$PWD/creds/sentinel-client.creds"
BEFORE=$(count_violations)

set +e
(
  cd "$CORE_DIR"
  ZITADEL_SERVICE_USER_KEY="$KEY_ABS" \
  ZITADEL_ISSUER_URL="$(env_value GESTION_ZITADEL_ISSUER_URL)" \
  ZITADEL_PROJECT_ID="$(env_value GESTION_ZITADEL_PROJECT_ID)" \
  NATS_URL="${NATS_URL:-nats://localhost:4222}" \
  NATS_CREDS="$CREDS_ABS" \
    npx ts-node tests/tools/bus-policy-probe.ts --profile "$PROFILE"
)
STATUS=$?
set -e

AFTER=$(count_violations)
echo "server log: $((AFTER - BEFORE)) new Violation line(s)"
docker logs "$NATS_CONTAINER" 2>&1 | grep -E 'Publish Violation|Subscription Violation' | tail -n "$((AFTER - BEFORE))" || true

exit "$STATUS"
