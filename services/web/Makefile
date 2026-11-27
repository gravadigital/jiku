# web — internal frontend (Next.js).
# Run from the repository root (`make <target> S=web`) or from here.

ROOT := $(abspath ../..)
JUNIT := $(ROOT)/reports/junit
PLAYWRIGHT_IMAGE := mcr.microsoft.com/playwright:v1.65.1-noble

.PHONY: up down logs dev test test-unit test-integration test-e2e test-perf lint typecheck fmt check migrate build

up down logs dev migrate build:
	$(MAKE) -C $(ROOT) $@ S=web

lint:
	npm run lint

typecheck:
	npx tsc --noEmit -p tsconfig.typecheck.json

fmt:
	npx prettier --write .

test-unit:
	@mkdir -p $(JUNIT)
	npx vitest run --reporter=default --reporter=junit --outputFile.junit=$(JUNIT)/web-unit.xml

test-integration:
	@echo "web test-integration: no integration level (the frontend is covered by unit and end-to-end tests)"

# Playwright in its official image, on the host network: the browser reaches the product of
# `make up` at the same URLs a person uses (localhost:3000/3001, idp.localhost:9400).
test-e2e:
	@mkdir -p $(JUNIT) $(ROOT)/reports/playwright
	docker run --rm --network host --ipc host --user $$(id -u):$$(id -g) -e HOME=/tmp \
		-e PLAYWRIGHT_JUNIT_OUTPUT_NAME=/repo/reports/junit/web-e2e.xml \
		-v $(ROOT):/repo -w /repo/services/web $(PLAYWRIGHT_IMAGE) \
		npx playwright test

test-perf:
	@echo "web test-perf: no NFR is verified by a performance test yet"

test: test-unit test-integration test-e2e

check: lint typecheck test
