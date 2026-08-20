#!/usr/bin/env bash
#
# local.sh — brings the whole of Jiku up on this machine.
#
#   ./local.sh up      bring everything up
#   ./local.sh down    take everything down and delete the data
#   ./local.sh logs    follow the logs (optional: ./local.sh logs api)
#
# Three things have to be prepared before the first start. The step by step is in
# README.md; in short:
#
#   1. cp .env.dist .env   and fill in the values
#   2. ./service-user-key.sh api <key.json>   (and the same for core)
#   3. generate the NATS identity in nats/creds/   (see nats/creds/README.md)
#
# The S3 storage is local and needs nothing prepared: `up` brings MinIO up and creates
# the bucket. STORAGE_S3_ENDPOINT already comes pointed at it in .env.dist.
#
# The services request their own token from Zitadel with those keys and renew it
# themselves: there is nothing to refresh by hand.
#
# DUMP_FILE has to point at a .sql holding the schema: the migrations start from an
# existing schema and do not create it. Against an empty database the api fails to start.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.local.yml"

[[ -f .env ]] || { echo "deploy/.env is missing — copy .env.dist and fill it in" >&2; exit 1; }
set -a; . ./.env; set +a

# The callout reads the creds (mode 600) with the host's uid.
HOST_UID=$(id -u); HOST_GID=$(id -g)
export HOST_UID HOST_GID

case "${1:-up}" in
  up)
    [[ -f nats/creds/nats-resolver.conf ]] || {
      echo "nats/creds/nats-resolver.conf is missing: without the NATS identity the" >&2
      echo "server does not start in operator mode. See nats/creds/README.md" >&2
      exit 1
    }

    echo "==> database"
    $COMPOSE up -d database
    until docker exec jiku-local-database pg_isready -U "$DATABASE_USER" -q 2>/dev/null; do
      sleep 1
    done

    # The dump is loaded only once: if tables already exist, whatever is there stays.
    if [[ -n "${DUMP_FILE:-}" ]]; then
      if ! docker exec jiku-local-database psql -U "$DATABASE_USER" -d "$DATABASE_NAME" \
           -tAc "SELECT to_regclass('public.clients')" | grep -q clients; then
        [[ -f "$DUMP_FILE" ]] || { echo "DUMP_FILE does not exist: $DUMP_FILE" >&2; exit 1; }
        echo "==> loading $DUMP_FILE (this can take a while)"
        docker exec -i jiku-local-database psql -q -U "$DATABASE_USER" -d "$DATABASE_NAME" \
          < "$DUMP_FILE" > /dev/null
      fi
    fi

    # The api connects with a user that can only read: that is what enforces the split.
    # Migrations are the exception and use the database owner's credentials.
    echo "==> read-only user"
    docker exec -i jiku-local-database psql -q -U "$DATABASE_USER" -d "$DATABASE_NAME" <<SQL > /dev/null
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DATABASE_READONLY_USER') THEN
    CREATE USER $DATABASE_READONLY_USER WITH PASSWORD '$DATABASE_READONLY_PASSWORD';
  END IF;
END \$\$;
GRANT CONNECT ON DATABASE $DATABASE_NAME TO $DATABASE_READONLY_USER;
GRANT USAGE ON SCHEMA public TO $DATABASE_READONLY_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $DATABASE_READONLY_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $DATABASE_READONLY_USER;
SQL

    # El bucket se crea acá y no en el compose: es bootstrap del entorno, igual que el
    # usuario de solo lectura de arriba. MinIO arranca con el bucket vacío y `core` NO lo
    # crea —firma contra un bucket que da por existente—, así que sin este paso la primera
    # subida falla con NoSuchBucket.
    echo "==> storage"
    $COMPOSE up -d storage
    until docker exec jiku-local-storage mc --version >/dev/null 2>&1; do sleep 1; done
    docker exec jiku-local-storage sh -c "
      until mc alias set local http://127.0.0.1:9000 '$STORAGE_S3_CREDENTIALS_ACCESSKEY' '$STORAGE_S3_CREDENTIALS_SECRETKEY' >/dev/null 2>&1; do sleep 1; done
      mc mb --ignore-existing local/'$STORAGE_S3_BUCKETNAME' >/dev/null
    "

    echo "==> the rest of the stack"
    $COMPOSE up -d --build

    echo
    echo "ready:"
    echo "  web       http://localhost:3000"
    echo "  opus-web  http://localhost:3001"
    echo "  api       http://localhost:3100"
    echo "  nats      http://localhost:8222  (monitoring)"
    ;;

  down)
    $COMPOSE down -v
    ;;

  logs)
    $COMPOSE logs -f "${2:-}"
    ;;

  *)
    echo "usage: ./local.sh [up|down|logs]" >&2
    exit 1
    ;;
esac
