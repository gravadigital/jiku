# jiku flow adoption

> Report of the adoption on {{fill: date}} (requirement #{{fill: id}}). It is a record of that day: it is
> not kept up to date. Whatever you decide to do with what it lists becomes a Jiku requirement
> (`/jflow-spec` + `/jflow-build`) or a direct change (`/jflow-fix`).

## Summary

| | |
|---|---|
| Definition | {{fill: n blocks, m entities, k operations, invariants, guarantees, decisions, flows}} |
| Ready to specify and implement | Yes: the repository meets the minimum (M1–M9), verified |
| Fixes made during the adoption | {{fill: n}} |
| Recorded in Jiku | {{fill: the security issues #…, or «Nothing.»}} |
| In this report | {{fill: n bugs, n behaviours to confirm, n suggested defaults, n other improvements}} |
| Coverage by ID | {{fill: x/y (the earlier tests carry no IDs)}} |

## Baseline

How the repository was before the adoption, running its own commands.

| Earlier command | Result |
|---|---|
| {{fill: each command the repo had to install, build, lint and test, and whether it passed or how many tests failed}} | |

## Fixes made during the adoption

What the adoption changed to reach the jiku flow minimum. The product logic only changed to make an
existing test that was failing pass: each case names the test.

| Minimum | What was done | How it was checked |
|---|---|---|
| {{fill: M1–M9, one row per fix: what was moved, added or fixed, and the command that proves it}} | | |

## Recorded in Jiku

| # | Title | Why |
|---|---|---|
| {{fill: one row per security issue}} | | |

## Suspected bugs

They are not security bugs, so they were not recorded in Jiku. The definition documents them as they
work today.

### B-01 {{fill: title}}

- **What happens:** {{fill: the current behaviour}}
- **Why it looks like a bug:** {{fill}}
- **Where:** {{fill: definition IDs and `file:line`}}
- **Suggested severity:** {{fill: high, medium or low, and why}}

## Behaviours to confirm

Behaviours that may or may not be intentional, left without an answer during the adoption. The
definition documents them as they are, with no decision. When specifying something that touches them,
it is worth deciding them.

| Behaviour | Doubt | IDs |
|---|---|---|
| {{fill: «None.» if all of them were answered}} | | |

## jiku flow defaults the product does not follow

New products follow them from the start; this one follows them from now on in what is new. Bringing
what exists in line is optional: if one is kept on purpose, it becomes a technical decision when it is
specified.

| Default | Today | Suggested change | Effort |
|---|---|---|---|
| {{fill: one per deviation outside the minimum}} | | | |

## Other suggested improvements

| Improvement | Why | Effort |
|---|---|---|
| {{fill: technical debt, missing tests, refactors worth considering; «None.» if there are none}} | | |

## Contradictions

{{fill: contradictory behaviours both documented in the definition; «None.» if there are none}}
