# core — the only service that writes the database; answers commands and queries over NATS.
# Run from the repository root (`make <target> S=core`) or from here.

ROOT := $(abspath ../..)
JUNIT := $(ROOT)/reports/junit
REPORTERS := --reporter mocha-multi-reporters --reporter-options configFile=$(ROOT)/mocha-reporters.json
COMPOSE := docker compose -f $(ROOT)/docker-compose.yml
TEST_DB_PORT ?= 55433
# The suite runs on the `postgres-test` service of the root compose, with the schema the
# migrations of services/api build (tests/global-setup.ts), in its own database.
TEST_DB_ENV := TEST_DATABASE=external POSTGRESQL_HOST=127.0.0.1 POSTGRESQL_PORT=$(TEST_DB_PORT) \
	POSTGRESQL_DB=gestionTestCore POSTGRESQL_USER=test POSTGRESQL_PASSWORD=testing

.PHONY: up down logs dev test test-unit test-integration test-e2e test-perf lint typecheck fmt check migrate build test-db

up down logs dev migrate build:
	$(MAKE) -C $(ROOT) $@ S=core

lint:
	npx eslint ./src

typecheck:
	npx tsc --noEmit -p .

fmt:
	npx prettier --write .

test-unit:
	@echo "core test-unit: no separate unit level; the whole mocha suite runs against the database (test-integration)"

test-db:
	$(COMPOSE) --profile test up -d --wait postgres-test
	@$(COMPOSE) exec -T postgres-test psql -U test -d gestionTest -tAc \
		"SELECT 1 FROM pg_database WHERE datname = 'gestionTestCore'" | grep -q 1 || \
		$(COMPOSE) exec -T postgres-test psql -U test -d gestionTest -c 'CREATE DATABASE "gestionTestCore"'

test-integration: test-db
	@mkdir -p $(JUNIT)
	$(TEST_DB_ENV) MOCHA_FILE=$(JUNIT)/core-integration.xml npx mocha "tests/**/*.test.ts" $(REPORTERS)

# A NATS client against the broker of `make up`, authenticated through the auth-callout with
# real tokens of the fake identity provider.
test-e2e:
	@mkdir -p $(JUNIT)
	NATS_URL=nats://localhost:$${NATS_PORT:-4222} MOCHA_FILE=$(JUNIT)/core-e2e.xml npx mocha --no-config -r ts-node/register --timeout 30000 "e2e/**/*.e2e.ts" $(REPORTERS)

test-perf:
	@echo "core test-perf: no NFR is verified by a performance test yet"

test: test-unit test-integration test-e2e

check: lint typecheck test
