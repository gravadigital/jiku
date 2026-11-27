# The single entry point for running anything. Each target delegates to services/*/Makefile;
# S={service} limits it to one (api, core, web, opus-web).
#
#   make up | down | logs | dev       the whole product with Docker Compose
#   make check                        lint + typecheck + test (every level)
#   make test-unit | test-integration | test-e2e | test-perf
#   make lint | typecheck | fmt | migrate | build
#
# Test reports: reports/junit/{service}-{level}.xml

SERVICES := api core web opus-web
S ?=
TARGETS := $(if $(S),$(S),$(SERVICES))
COMPOSE := docker compose

.PHONY: up down logs dev test test-unit test-integration test-e2e test-perf lint typecheck fmt check migrate build install packages

# Dependencies of the workspace (and the shared packages, built by postinstall). Only reinstalled
# when the lockfile changes.
install: node_modules/.package-lock.json
node_modules/.package-lock.json: package-lock.json
	npm ci
	@touch $@

up:
	$(COMPOSE) up -d --build --wait $(S)
	@echo
	@echo "web       http://localhost:3000"
	@echo "opus-web  http://localhost:3001"
	@echo "api       http://localhost:3100"
	@echo "identity  http://localhost:9400 (fake identity provider: pick a user)"
	@echo "mail      http://localhost:8025 (Mailpit)"
	@echo "storage   http://localhost:9001 (MinIO console)"

down:
	$(COMPOSE) --profile test down --remove-orphans

logs:
	$(COMPOSE) logs -f $(S)

# Rebuilds and restarts a service when its code changes (docker compose watch).
dev:
	$(COMPOSE) up --build --watch $(S)

migrate:
	$(COMPOSE) build api
	$(COMPOSE) run --rm migrate

build:
	$(COMPOSE) build $(S)

lint typecheck test-integration: install
	@set -e; for s in $(TARGETS); do $(MAKE) -C services/$$s $@; done

# The shared packages have their own unit tests; they run with the unit level of the whole repo.
test-unit: install
	@set -e; if [ -z "$(S)" ]; then $(MAKE) packages; fi; for s in $(TARGETS); do $(MAKE) -C services/$$s $@; done

packages:
	@mkdir -p reports/junit
	cd packages/nats-protocol && MOCHA_FILE=../../reports/junit/nats-protocol-unit.xml \
		npx mocha "tests/**/*.test.ts" --reporter mocha-multi-reporters --reporter-options configFile=../../mocha-reporters.json

# End to end, against the product brought up by `make up` (started here when it is not).
test-e2e: install
	$(COMPOSE) up -d --build --wait
	@set -e; for s in $(TARGETS); do $(MAKE) -C services/$$s $@; done

test: test-unit test-integration test-e2e

test-perf:
	@echo "test-perf: no NFR is verified by a performance test yet"

fmt: install
	npx prettier --write .

check: lint typecheck test
