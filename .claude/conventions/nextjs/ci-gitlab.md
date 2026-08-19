---
id: ci-gitlab
display_name: CI/CD (GitLab)
language: nextjs
description: GitLab CI pipeline for Next.js — build, lint, type-check, test, and release with Docker
applies_to: [frontend]
required_by: []
package: null
---

# CI/CD GitLab (Next.js)

GitLab CI pipeline for Next.js applications. Follows the same Docker-based strategy as the Node convention: all stages run inside Docker using the `test` and `production` stages from the `dockerfile` convention. Three pipeline stages: `build`, `test` (lint + type-check + unit tests), `release`.

## When to use

Any Next.js app using GitLab CI/CD and the `dockerfile` convention.

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
# Stage: Test — Type check
# ============================================
typecheck:
  stage: test
  extends: .docker_login
  needs: [build]
  script:
    - docker pull $PIPELINE_IMAGE
    - docker run --rm $PIPELINE_IMAGE npm run typecheck
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ============================================
# Stage: Test — Unit tests (Vitest)
# ============================================
test:
  stage: test
  extends: .docker_login
  needs: [build]
  script:
    - docker pull $PIPELINE_IMAGE
    - docker run --name test-runner $PIPELINE_IMAGE npm run test:ci
    - docker cp test-runner:/app/junit.xml ./junit.xml || true
    - docker cp test-runner:/app/coverage ./coverage || true
    - docker rm test-runner || true
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
  needs: [lint, typecheck, test]
  script:
    - docker pull $IMAGE_NAME:dev || true
    # Load NEXT_PUBLIC_* vars from .env.dev and pass as build args
    - export $(grep -v '^#' .env.dev | xargs)
    - docker build
        --target production
        --cache-from $IMAGE_NAME:dev
        --env-file .env.dev
        -t $IMAGE_NAME:dev .
    - docker push $IMAGE_NAME:dev
  rules:
    - if: $CI_COMMIT_BRANCH == "dev"

# ============================================
# Stage: Release — main branch (versioned)
# ============================================
release:main:
  stage: release
  extends: .docker_login
  needs: [lint, typecheck, test]
  script:
    - VERSION=$(cat version.txt)
    - docker pull $IMAGE_NAME:main || true
    # Load NEXT_PUBLIC_* vars from .env.prod and pass as build args
    - export $(grep -v '^#' .env.prod | xargs)
    - docker build
        --target production
        --cache-from $IMAGE_NAME:main
        --env-file .env.prod
        -t $IMAGE_NAME:$VERSION
        -t $IMAGE_NAME:main .
    - docker push $IMAGE_NAME:$VERSION
    - docker push $IMAGE_NAME:main
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### Required package.json scripts

```json
{
  "scripts": {
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:ci": "vitest run --reporter=junit --outputFile=junit.xml --coverage"
  }
}
```

## Running CI tests locally

```bash
#!/bin/bash
# run-ci-tests.sh — replicates the GitLab CI test stage locally

set -e

TEST_CONTAINER="test-runner"
IMAGE_NAME="{service}:ci-test"

cleanup() {
  docker rm -f $TEST_CONTAINER 2>/dev/null || true
}
trap cleanup EXIT
cleanup

echo "[CI] Building test image..."
docker build --target test -t $IMAGE_NAME .

echo "[CI] Running tests..."
docker run --name $TEST_CONTAINER $IMAGE_NAME npm run test:ci

echo "[CI] Copying artifacts..."
docker cp $TEST_CONTAINER:/app/junit.xml ./junit.xml 2>/dev/null || true
docker cp $TEST_CONTAINER:/app/coverage ./coverage 2>/dev/null || true

echo "[CI] Done."
```

Next.js unit tests (Vitest) have no external dependencies — no DB or Redis containers needed. E2E tests (Playwright) run separately and are not part of this pipeline stage.

## E2E tests (optional stage)

If the service uses `testing-e2e`, add a separate stage that runs against the built production image:

```yaml
# ============================================
# Stage: E2E (optional — only on main/dev)
# ============================================
e2e:
  stage: e2e   # add 'e2e' to the stages list
  extends: .docker_login
  needs: [release:dev]  # or release:main
  script:
    - docker pull $IMAGE_NAME:dev
    - docker run -d --name app -p 3000:3000 -e DATABASE_URL=$DATABASE_URL $IMAGE_NAME:dev
    - docker run --rm --link app:app
        -v $(pwd)/tests:/tests
        mcr.microsoft.com/playwright:v1.48.0-jammy
        npx playwright test --config=/tests/playwright.config.ts
    - docker stop app && docker rm app
  rules:
    - if: $CI_COMMIT_BRANCH == "dev"
    - if: $CI_COMMIT_BRANCH == "main"
```

## Rules

- Next.js unit tests have no external dependencies — no `--link` containers needed in the `test` stage.
- `typecheck` runs `tsc --noEmit` as a separate job — it catches type errors that lint and tests may miss.
- `NEXT_PUBLIC_*` build args differ per environment (`dev` vs `main`). Store them as GitLab CI/CD variables.
- Server-only secrets (`DATABASE_URL`, `AUTH_SECRET`) are never passed as build args. They are injected at runtime.
- `run-ci-tests.sh` must exist and mirror the CI `test` stage. For Next.js this is simpler than Node — no dependency containers.
- E2E tests are a separate optional stage, not part of the standard `test` stage, because they require a running app and are slower.
- The `release` stage builds `--target production` with `output: 'standalone'`. Verify `next.config.ts` has this set.

## Integration with other conventions

- **dockerfile**: pipeline stages map directly to Dockerfile stages (`test` → CI build/test, `production` → release).
- **testing-unit**: `npm run test:ci` runs Vitest with JUnit reporter. Configure in `vitest.config.mts`.
- **testing-e2e**: E2E tests run as a separate optional pipeline stage after release, not in the standard test stage.
