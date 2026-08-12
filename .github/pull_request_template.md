## What this changes

<!-- What problem it solves. If it fixes a bug, how it reproduced. -->

## Notes for the reviewer

<!--
Anything that is not obvious from the diff: a decision you weighed, something you left
out on purpose, a limitation you are aware of.
-->

## Checklist

- [ ] `npm run build`, `npm test` and `npm run lint` pass
- [ ] Tests added or updated for the change in behaviour
- [ ] `CHANGELOG.md` updated under `[Unreleased]`, if a user would notice this
- [ ] If it changes the NATS protocol, `docs/nats-protocol.md` was updated in
      the same PR — that document is the contract, and it wins over the code
