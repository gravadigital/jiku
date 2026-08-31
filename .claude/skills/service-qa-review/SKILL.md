---
name: service-qa-review
description: Verify an implementation against its Story Plan in a clean context, separate from whoever wrote the code. Reports discrepancies only - never fixes code.
argument-hint: "[story-plan-path] [changed-files-csv]"
context: fork
model: sonnet
background: false
allowed-tools: "Read, Glob, Grep, Bash"
disallowed-tools: "Write, Edit, NotebookEdit"
---

# QA Review

## Purpose

Verify implementation correctness by reviewing code in a **clean context**, separate from
whoever wrote it. Report discrepancies between what was specified and what was implemented.

**Flow:**
```
Step 0: Parse arguments (Story Plan path + changed files)
  |
Step 1: Read the Story Plan
  |
Step 2: Run the four verification checks
  |
Step 3: Return the structured report
```

**Result:** A structured QA report consumed by the caller.

**This command does NOT:**
- Fix code, write tests, or suggest code changes
- Re-run quality verification (lint, build, tests)

These are handled by the caller in `/service-implement-story` Step 5.5.2.

## References

The Story Plan is the single source of truth. Never assume what "should" be — verify only
against what is documented in it.

## CRITICAL RULES

1. **Use Spanish** for the report content
2. **Story Plan is the single source of truth** - Compare against its Test Scenarios, ADR
   Implementation Rules, Acceptance Criteria and API/DB Context
3. **Never fix anything** - This skill runs with `Write`/`Edit` removed. Report only; the
   caller applies fixes
4. **Clean context by design** - This skill runs forked: it has no access to the
   conversation that wrote the code. Everything it needs arrives in `$ARGUMENTS`

## Execution

### Step 0: Parse Arguments

`$ARGUMENTS` carries two parts separated by `|`:

- **Story Plan path** - absolute or repo-relative path to the Story Plan file
- **Changed files** - comma-separated list of files created/modified during implementation

If either part is missing, ABORT reporting exactly what was not received.

---

### Step 1: Read the Story Plan

Read the Story Plan in full. Extract the Test Scenarios table, the Relevant ADRs section
with its Implementation Rules, the Acceptance Criteria Coverage table, and the API and
Database Context sections.

---

### Step 2: Verification Checks

1. **Test Scenario Coverage**: For each TS-X in the Story Plan's Test Scenarios table, verify that a corresponding test exists in the codebase. The test MUST use the same inputs and assert the same outputs specified in the scenario. Flag any TS-X without a matching test, or where the test uses different values/fields than specified.
2. **ADR Implementation Rules Compliance**: For each Implementation Rule from the Relevant ADRs section in the Story Plan, verify that the implementation code respects it. Check exact values (timeouts, formats, field names, error codes, algorithms) — not just general approach. Flag any rule that is violated or not verifiable from the code.
3. **Acceptance Criteria Verification**: For each AC in the Acceptance Criteria Coverage table, verify that at least one test validates it. Flag any AC without test coverage.
4. **Contract Exactness**: Verify that field names in implementation code match exactly those specified in the API Context and Database Context sections of the Story Plan. Flag any mismatches (renamed fields, different types, missing fields).
5. **No False Positives**: Only flag issues you can verify from the code. If you cannot determine compliance (e.g., runtime behavior), note it as "⚠️ Cannot verify from static review" rather than flagging it as a failure.
6. **No Fixes**: Do NOT suggest code changes or write code. Only report what you found. The caller handles fixes.
7. **Report Format**: Return findings as a structured list:
   ```
   ## QA Review Results

   ### ✅ Passed
   - [list of checks that passed]

   ### ❌ Issues Found
   - **[TS-X / ADR-X Rule / AC-X]**: [what was expected] vs [what was found]
   - ...

   ### Summary
   - Test Scenarios: X/Y covered
   - ADR Rules: X/Y compliant
   - Acceptance Criteria: X/Y verified
   ```

---

### Step 3: Return the Report

Return the report in the format above. Nothing else — the caller parses it.

## Output

Text output only. No files created or modified.
