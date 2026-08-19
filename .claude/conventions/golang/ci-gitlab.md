---
id: ci-gitlab
display_name: CI/CD (GitLab)
language: golang
description: GitLab CI pipeline — lint, test, build, release with Docker
applies_to: [api, worker, cli]
required_by: []
package: null
---

# CI/CD (Go, GitLab)

GitLab CI pipeline for Go services: lint, test (with race detector and coverage), build, and release a Docker image. Fast feedback on merge requests, image publishing on the default branch / tags.

## When to use

Every Go service hosted on GitLab. The same stage layout adapts to other CI systems (GitHub Actions, etc.); only syntax changes.

## Pipeline

```yaml
# .gitlab-ci.yml
stages: [lint, test, build, release]

variables:
  GO_VERSION: "1.23"

default:
  image: golang:${GO_VERSION}

lint:
  stage: lint
  script:
    - go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
    - golangci-lint run ./...

test:
  stage: test
  script:
    - go test -race -short -coverprofile=cover.out ./...
    - go tool cover -func=cover.out | tail -1
  coverage: '/total:\s+\(statements\)\s+(\d+\.\d+)%/'

build:
  stage: build
  script:
    - CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o app ./cmd/${CI_PROJECT_NAME}
  artifacts:
    paths: [app]
    expire_in: 1 hour

release:
  stage: release
  image: docker:27
  services: [docker:27-dind]
  rules:
    - if: '$CI_COMMIT_TAG'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
```

## Rules

- Pipeline stages: **lint → test → build → release**. A failing earlier stage blocks the rest.
- `lint` runs `golangci-lint` with the repo's `.golangci.yml`. Lint failures block the merge.
- `test` runs with `-race` and produces a coverage report. Unit tests (`-short`) always; integration tests on the default branch or a dedicated job.
- `release` (image build + push) runs only on the default branch and tags — never on every MR.
- Pin the Go and tool versions (`GO_VERSION`, base images). No `latest` in release images.
- Secrets come from GitLab CI/CD variables (masked/protected), never committed.
- The pipeline is reproducible: same commit → same result. No reliance on mutable external state.

## Integration with other conventions

- **testing**: the `test` stage runs `go test -race -short` (unit) and the integration suite per the testing convention.
- **dockerfile**: the `release` stage builds the image defined by the dockerfile convention.
