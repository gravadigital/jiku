#!/usr/bin/env bash
#
# local.sh — levanta Jiku completo en la máquina.
#
#   ./local.sh up      levanta todo
#   ./local.sh down    baja todo y borra los datos
#   ./local.sh logs    sigue los logs (opcional: ./local.sh logs api)
#
# Antes del primer arranque hay que preparar tres cosas. El paso a paso está en
# README.md; en resumen:
#
#   1. cp .env.dist .env   y completar los valores
#   2. ./service-user-key.sh api <key.json>   (y lo mismo para core)
#   3. generar la identidad de NATS en nats/creds/   (ver nats/creds/README.md)
#
# Los servicios piden su propio token a Zitadel con esas keys y lo renuevan solos: no hay
# nada que refrescar a mano.
#
# DUMP_FILE tiene que apuntar a un .sql con el esquema: las migraciones parten de un
# esquema existente y no lo crean. Contra una base vacía, la api falla al arrancar.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.local.yml"

[[ -f .env ]] || { echo "falta deploy/.env — copiá .env.dist y completalo" >&2; exit 1; }
set -a; . ./.env; set +a

# El callout lee las creds (modo 600) con el uid del host.
HOST_UID=$(id -u); HOST_GID=$(id -g)
export HOST_UID HOST_GID

case "${1:-up}" in
  up)
    [[ -f nats/creds/nats-resolver.conf ]] || {
      echo "falta nats/creds/nats-resolver.conf: sin la identidad de NATS el servidor" >&2
      echo "no arranca en modo operator. Ver nats/creds/README.md" >&2
      exit 1
    }

    echo "==> base de datos"
    $COMPOSE up -d database
    until docker exec jiku-local-database pg_isready -U "$DATABASE_USER" -q 2>/dev/null; do
      sleep 1
    done

    # El dump se carga una sola vez: si ya hay tablas, se respeta lo que haya.
    if [[ -n "${DUMP_FILE:-}" ]]; then
      if ! docker exec jiku-local-database psql -U "$DATABASE_USER" -d "$DATABASE_NAME" \
           -tAc "SELECT to_regclass('public.clients')" | grep -q clients; then
        [[ -f "$DUMP_FILE" ]] || { echo "no existe DUMP_FILE: $DUMP_FILE" >&2; exit 1; }
        echo "==> cargando $DUMP_FILE (puede tardar)"
        docker exec -i jiku-local-database psql -q -U "$DATABASE_USER" -d "$DATABASE_NAME" \
          < "$DUMP_FILE" > /dev/null
      fi
    fi

    # La api conecta con un usuario que solo puede leer: es la garantía del split. Las
    # migraciones son la excepción y usan las credenciales del dueño de la base.
    echo "==> usuario de solo lectura"
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

    echo "==> el resto del stack"
    $COMPOSE up -d --build

    echo
    echo "listo:"
    echo "  web       http://localhost:3000"
    echo "  opus-web  http://localhost:3001"
    echo "  api       http://localhost:3100"
    echo "  nats      http://localhost:8222  (monitoreo)"
    ;;

  down)
    $COMPOSE down -v
    ;;

  logs)
    $COMPOSE logs -f "${2:-}"
    ;;

  *)
    echo "uso: ./local.sh [up|down|logs]" >&2
    exit 1
    ;;
esac
