# api — HTTP service that reads the database and publishes commands to core over NATS.
# Run from the repository root (`make <target> S=api`) or from here.

ROOT := $(abspath ../..)
JUNIT := $(ROOT)/reports/junit
REPORTERS := --reporter mocha-multi-reporters --reporter-options configFile=$(ROOT)/mocha-reporters.json
COMPOSE := docker compose -f $(ROOT)/docker-compose.yml
TEST_DB_PORT ?= 55433
# The suite runs on the `postgres-test` service of the root compose, with the schema the
# migrations build (tests/global-setup.ts), in its own database.
TEST_DB_ENV := TEST_DATABASE=external POSTGRESQL_HOST=127.0.0.1 POSTGRESQL_PORT=$(TEST_DB_PORT) \
	POSTGRESQL_DB=gestionTestApi POSTGRESQL_USER=test POSTGRESQL_PASSWORD=testing

.PHONY: up down logs dev test test-unit test-integration test-e2e test-perf lint typecheck fmt check migrate build test-db

up down logs dev migrate build:
	$(MAKE) -C $(ROOT) $@ S=api

lint:
	npx eslint ./lib

typecheck:
	npx tsc --noEmit -p .

fmt:
	npx prettier --write .

test-unit:
	@echo "api test-unit: no separate unit level; the whole mocha suite runs against the database (test-integration)"

test-db:
	$(COMPOSE) --profile test up -d --wait postgres-test
	@$(COMPOSE) exec -T postgres-test psql -U test -d gestionTest -tAc \
		"SELECT 1 FROM pg_database WHERE datname = 'gestionTestApi'" | grep -q 1 || \
		$(COMPOSE) exec -T postgres-test psql -U test -d gestionTest -c 'CREATE DATABASE "gestionTestApi"'

test-integration: test-db
	@mkdir -p $(JUNIT)
	$(TEST_DB_ENV) MOCHA_FILE=$(JUNIT)/api-integration.xml npx mocha "tests/**/*.test.ts" $(REPORTERS)

# HTTP client against `make up` (port 3100), with real tokens of the fake identity provider.
test-e2e:
	@mkdir -p $(JUNIT)
	MOCHA_FILE=$(JUNIT)/api-e2e.xml npx mocha --no-config -r ts-node/register --timeout 30000 "e2e/**/*.e2e.ts" $(REPORTERS)

test-perf:
	@echo "api test-perf: no NFR is verified by a performance test yet"

test: test-unit test-integration test-e2e

check: lint typecheck test
