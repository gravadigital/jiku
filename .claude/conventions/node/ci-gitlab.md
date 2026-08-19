---
id: ci-gitlab
display_name: CI/CD (GitLab)
language: node
description: GitLab CI pipeline — build, lint, test with Docker, and release with semantic versioning
applies_to: [api, worker, cli]
required_by: []
package: null
---

# CI/CD GitLab (Node)

GitLab CI pipeline for Node.js services. All stages run inside Docker using the `test` and `production` stages from the `dockerfile` convention. Three pipeline stages: `build` (Docker image), `test` (lint + tests), `release` (versioned production image).

Tests run the same way in CI and locally — using `run-ci-tests.sh` to replicate the exact CI environment on any developer machine.

## When to use

Any Node service using GitLab CI/CD and the `dockerfile` convention.

## Package

```
# No npm package — GitLab CI configuration
# Requires: dockerfile convention, GitLab Container Registry
```

## Configuration

```yaml
# .gitlab-ci.yml
image: docker:24.0.5-cli

variables:
  IMAGE_NAME: $CI_REGISTRY_IMAGE
  PIPELINE_IMAGE: $CI_REGISTRY_IMAGE:$CI_PIPELINE_ID
  DOCKER_TLS_CERTDIR: "/certs"

services:
  - docker:24.0.5-dind

stages:
  - build
  - test
  - release

# ============================================
# Template: Registry login
# ============================================
.docker_login:
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

# ============================================
# Stage: Build
# ============================================
build:
  stage: build
  extends: .docker_login
  script:
    - docker pull $IMAGE_NAME:dev || true
    - docker build --target test --cache-from $IMAGE_NAME:dev -t $PIPELINE_IMAGE .
    - docker push $PIPELINE_IMAGE
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ============================================
# Stage: Test — Lint
# ============================================
lint:
  stage: test
  extends: .docker_login
  needs: [build]
  script:
    - docker pull $PIPELINE_IMAGE
    - docker run --rm $PIPELINE_IMAGE npm run lint
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ============================================
# Stage: Test — Unit & Integration
# ============================================
test:
  stage: test
  extends: .docker_login
  needs: [build]
  script:
    - docker pull $PIPELINE_IMAGE
    # Start dependencies (adapt per service — add redis, etc. as needed)
    - docker run
        -e POSTGRES_DB={service}_test
        -e POSTGRES_USER=test_user
        -e POSTGRES_PASSWORD=test_password
        --name database -d postgres:16-alpine
    # Wait for DB to be ready
    - |
      for i in $(seq 1 30); do
        docker exec database pg_isready -U test_user -d {service}_test > /dev/null 2>&1 && break
        [ $i -eq 30 ] && echo "DB not ready" && exit 1
        sleep 1
      done
    # Run tests
    - docker run --name test-runner --link database:database $PIPELINE_IMAGE npm run test:ci
    # Copy artifacts
    - docker cp test-runner:/app/junit.xml ./junit.xml || true
    - docker cp test-runner:/app/coverage ./coverage || true
    # Cleanup
    - docker rm test-runner || true
    - docker stop database && docker rm database || true
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    when: always
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 week
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ============================================
# Stage: Release — dev branch
# ============================================
release:dev:
  stage: release
  extends: .docker_login
  needs: [lint, test]
  script:
    - docker pull $IMAGE_NAME:dev || true
    # Non-secret env vars come from .env.dev (committed)
    # Secrets are injected at runtime via CI/CD variables
    - docker build --target production --cache-from $IMAGE_NAME:dev --env-file .env.dev -t $IMAGE_NAME:dev .
    - docker push $IMAGE_NAME:dev
  rules:
    - if: $CI_COMMIT_BRANCH == "dev"

# ============================================
# Stage: Release — main branch (versioned)
# ============================================
release:main:
  stage: release
  extends: .docker_login
  needs: [lint, test]
  script:
    - VERSION=$(cat version.txt)
    - docker pull $IMAGE_NAME:main || true
    # Non-secret env vars come from .env.prod (committed)
    # Secrets are injected at runtime via CI/CD variables
    - docker build --target production --cache-from $IMAGE_NAME:main --env-file .env.prod -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:main .
    - docker push $IMAGE_NAME:$VERSION
    - docker push $IMAGE_NAME:main
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

## Running CI tests locally

Every service using this convention must include a `run-ci-tests.sh` script that replicates the CI `test` stage exactly. This eliminates "works locally, fails in CI" issues.

```bash
#!/bin/bash
# run-ci-tests.sh — replicates the GitLab CI test stage locally

set -e

DB_CONTAINER="database"
TEST_CONTAINER="test-runner"
IMAGE_NAME="{service}:ci-test"

cleanup() {
  docker rm -f $TEST_CONTAINER 2>/dev/null || true
  docker stop $DB_CONTAINER 2>/dev/null && docker rm $DB_CONTAINER 2>/dev/null || true
}
trap cleanup EXIT
cleanup

echo "[CI] Building test image..."
docker build --target test -t $IMAGE_NAME .

echo "[CI] Starting dependencies..."
# Adapt: add redis, etc. as needed — must match .gitlab-ci.yml exactly
docker run \
  -e POSTGRES_DB={service}_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  --name $DB_CONTAINER -d postgres:16-alpine

echo "[CI] Waiting for DB..."
for i in $(seq 1 30); do
  docker exec $DB_CONTAINER pg_isready -U test_user -d {service}_test > /dev/null 2>&1 && break
  [ $i -eq 30 ] && echo "DB not ready" && exit 1
  sleep 1
done

echo "[CI] Running tests..."
docker run --name $TEST_CONTAINER --link $DB_CONTAINER:database $IMAGE_NAME npm run test:ci

echo "[CI] Copying artifacts..."
docker cp $TEST_CONTAINER:/app/junit.xml ./junit.xml 2>/dev/null || true
docker cp $TEST_CONTAINER:/app/coverage ./coverage 2>/dev/null || true

echo "[CI] Done."
```

Run with:
```bash
chmod +x run-ci-tests.sh
./run-ci-tests.sh
```

## Adapting dependencies per service

The test stage links dependency containers with `--link`. Add containers as needed:

**PostgreSQL only (default):**
```yaml
- docker run -e POSTGRES_DB=... --name database -d postgres:16-alpine
- docker run --link database:database $PIPELINE_IMAGE npm run test:ci
```

**PostgreSQL + Redis:**
```yaml
- docker run -e POSTGRES_DB=... --name database -d postgres:16-alpine
- docker run --name redis -d redis:7-alpine
- docker run --link database:database --link redis:redis $PIPELINE_IMAGE npm run test:ci
```

**Worker with no DB (tests are self-contained):**
```yaml
- docker run --rm $PIPELINE_IMAGE npm run test:ci
```

Mirror exactly the same dependencies in `run-ci-tests.sh`.

## Version file

The `release:main` stage reads the version from `version.txt` at the repo root:

```
# version.txt
1.4.2
```

Update this file as part of the release process. The pipeline tags the image with both `:{version}` and `:main`.

## Rules

- All pipeline stages run inside Docker — no direct Node/npm on the GitLab runner.
- The `test` stage builds `--target test` from the Dockerfile. The `release` stages build `--target production`. Never build production for tests.
- Cache from the previous image (`--cache-from`) to speed up builds. Always fall back gracefully (`|| true`).
- `run-ci-tests.sh` must exist in every service repo and must mirror the CI `test` stage exactly — same image, same dependency containers, same `--link` aliases, same command.
- Dependency containers in CI use fixed credentials (`test_user` / `test_password`). These are not secrets — they exist only for the test run.
- `PIPELINE_IMAGE` uses `$CI_PIPELINE_ID` as tag to isolate concurrent pipelines on the same runner.
- The `release:main` job reads the version from `version.txt`. Never hardcode versions in the pipeline.
- Artifacts (junit.xml, coverage) are always uploaded even on failure (`when: always`) so failures can be diagnosed.
- Non-secret env vars for each environment come from `.env.dev` and `.env.prod` (committed). Secrets are never in these files — they come from GitLab CI/CD variables injected at runtime.

## Integration with other conventions

- **dockerfile**: the pipeline is built around the multi-stage Dockerfile. The `test` stage maps to the CI `build`+`test` steps; `production` maps to `release`.
- **testing**: `npm run test:ci` is the test command run in CI. It must produce `junit.xml` and `coverage/cobertura-coverage.xml` for GitLab to parse.
