# Changelog

All notable changes to jiku flow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-27

First public release.

### Added

- **Skills** for the whole life of a product, connected to Jiku:
  - `/jflow-product-discover`: define a new product with the user — a decision-complete discovery
    (functional, domain, technical, database schemas) and the initial plan, created in Jiku as the base
    requirement plus one requirement per part, numbered in the order they are built.
  - `/jflow-product-scaffold`: specify and build the base product — every service's skeleton, tests at
    every level, CI, observability, the definition of what is built and the guides.
  - `/jflow-product-brownfield`: adopt an existing product — survey its code into the definition and
    bring the repository to the minimum (layout, Make, Compose, tests, CI), with an adoption report.
  - `/jflow-spec`: specify a requirement with the user, against the definition and the pending
    requirements; the specification lives in Jiku.
  - `/jflow-build`: implement a requirement end to end — plan, code, tests, definition and contracts —
    finished only when a clean-context verifier approves the evidence.
  - `/jflow-fix`: a bug fix or a small change that touches nothing documented.
  - `/jflow-release`, `/jflow-status` and `/jflow-framework-update`.
- **`jflow-verifier-agent`**: a read-only subagent that checks, in a clean context, that every
  acceptance criterion is proven by a passing test and that the definition and contracts are true.
- **`jflow.py`**: the deterministic half of the method (plan from the discovery, definition, indexes,
  checks, ID allocation against Jiku, context loading, specification in Jiku, branches, coverage,
  evidence from JUnit, MR text, release, status). Python standard library only.
- **The product definition** in `_jflow/`: what is built, with stable IDs that link Jiku criteria,
  code and tests.
- **Configurable language**: the user is answered in their language; what the product's people read
  (Jiku, discovery, README, `docs/`, CHANGELOG) goes in the product language (`language` in
  `_jflow/project.yaml`, Spanish by default); git, code and agent files in English. Document structure
  is read in English or Spanish.
- **`install.sh`**: installs jiku flow into a repository without touching the user's own `.claude/`
  content; `settings.json` and `CLAUDE.md` are merged and `.claude/.jflow-manifest` records jiku flow's
  files, so updates replace only what belongs to jiku flow and ask about local changes.
- **Engineering defaults** for every product: OpenTelemetry, health endpoints with version and
  dependencies, RFC 9457 errors, graceful shutdown, JUnit reports, an end-to-end test per entry point.

[Unreleased]: https://github.com/gravadigital/jiku-flow/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gravadigital/jiku-flow/releases/tag/v1.0.0
