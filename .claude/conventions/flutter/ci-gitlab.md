---
id: ci-gitlab
display_name: CI/CD (GitLab)
language: flutter
description: GitLab CI pipeline — format, analyze, test, build
applies_to: [frontend]
required_by: []
package: null
---

# CI/CD (Flutter, GitLab)

GitLab CI pipeline for Flutter apps: format check, static analysis, tests with coverage, and a build artifact. Fast feedback on merge requests; release builds on the default branch / tags.

## When to use

Every Flutter app hosted on GitLab. The stage layout adapts to other CI systems; only syntax changes.

## Pipeline

```yaml
# .gitlab-ci.yml
stages: [verify, test, build]

default:
  image: ghcr.io/cirruslabs/flutter:stable

verify:
  stage: verify
  script:
    - flutter pub get
    - dart format --output=none --set-exit-if-changed .
    - flutter analyze

test:
  stage: test
  script:
    - flutter pub get
    - flutter test --coverage
    # flutter test does not print a coverage summary; lcov emits a "lines......: XX.X%"
    # line that the coverage regex below captures (ensure lcov is in the image).
    - lcov --summary coverage/lcov.info
  coverage: '/lines\.+: (\d+\.\d+)%/'
  artifacts:
    paths: [coverage/lcov.info]
    expire_in: 1 week

build:
  stage: build
  rules:
    - if: '$CI_COMMIT_TAG'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
  script:
    - flutter pub get
    # If models/codegen are used:
    - dart run build_runner build --delete-conflicting-outputs
    - flutter build apk --release        # or appbundle / web / linux per target
  artifacts:
    paths: [build/app/outputs/]
    expire_in: 1 week
```

## Rules

- Pipeline stages: **verify → test → build**. A failing earlier stage blocks the rest.
- `verify` runs `dart format --set-exit-if-changed` (formatting is enforced) and `flutter analyze` (analyzer clean, warnings block merge).
- `test` runs `flutter test --coverage` and publishes the coverage report.
- If the app uses codegen (`freezed`/`json_serializable`), run `build_runner` before analyze/test/build, or commit generated files and verify they are up to date.
- `build` (release artifacts) runs only on the default branch and tags, not every MR.
- Pin the Flutter image tag. Signing keys and store credentials come from masked/protected CI variables, never committed.
- Target-specific builds (`apk`/`appbundle`/`web`/`linux`) are selected per app; document the targets in the README.

## Integration with other conventions

- **testing**: the `test` stage runs `flutter test --coverage`.
- **models-serialization**: codegen step runs before build when freezed/json_serializable are used.
- **env-config**: build-time config via `--dart-define-from-file` is supplied here for release builds.
