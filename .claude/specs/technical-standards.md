# Technical Standards

Formats and contracts for technical documentation. Read this before producing
architectures, APIs, database schemas, ADRs or system flows.

## Documentation Formats

### API Specifications
- **Format**: OpenAPI 3.0 YAML (never JSON)
- **Minimal structure**: Even if only `/health` exists, use proper OpenAPI format

### Database Schemas
- **Format**: Markdown + DBML
- **Structure**: Draft entities (preliminary markdown descriptions) + DBML schema,
  populated progressively. Draft entities are used when the full schema isn't
  defined yet; they coexist with DBML in the same file.

### Architectural Decision Records (ADRs)
- **Format**: Markdown
- **Structure**: Status, Context, Decision, Consequences (Positive/Negative/Risks),
  Alternatives Considered, References
- Document significant decisions: tech stack, database choice, auth strategy,
  service communication, deployment

### System Flows
- **Format**: Markdown, one file per flow
- **Purpose**: How services interact for each feature and system event
- **Content**: Step-by-step sequence with exact endpoints, field names, types,
  error handling
- **CRITICAL**: Field names in flows MUST match exactly the OpenAPI specs and DBML
  schemas — copy verbatim, never paraphrase. Flows are the cross-service source of
  truth: they connect individual API specs into end-to-end journeys.

## Reading Order

Before any technical decision:

1. Read the [Files index](.claude/utils/index.md) for locations — never hardcode paths
2. Read the PRD to understand product context
3. Read existing ADRs and architecture docs for decisions already taken
4. Read `docs/flows/` before designing cross-service changes — field names there are
   authoritative contracts between services

## Decision Criteria

- **Explain the "why"** — don't just recommend, state the reasoning
- **Present options with trade-offs** when several valid approaches exist
- **Prefer simplicity and pragmatism over over-engineering**
- Balance: complexity vs simplicity, performance vs maintainability, cost vs benefit
- Validate consistency with existing architecture and ADRs before proposing changes
