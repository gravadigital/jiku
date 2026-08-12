# Jiku documentation

Organised in four parts. Start with whichever matches what you are trying to do.

## 1. The product

What Jiku is and what it does.

| Document                   | Contents                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [features.md](features.md) | The domain — actors, projects, requirements, tasks, time tracking, attachments — the two surfaces, the roles, and what Jiku deliberately does not do. |

## 2. Installation and configuration

Getting it running.

| Document                             | Contents                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [installation.md](installation.md)   | Requirements, development setup, the three composes, the read-only database role, the identity provider, and troubleshooting. |
| [configuration.md](configuration.md) | Every environment variable, per service, with what breaks if it is wrong.                                                     |

## 3. Usage

Working with it.

| Document                                                     | Contents                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [usage.md](usage.md)                                         | The day-to-day flows: setting up work, requirements, tasks, logging hours, reports, the client portal, and operating the bus.            |
| [api-reference.md](api-reference.md)                         | The 61 HTTP endpoints, with the roles each requires and which ones write through the bus.                                                |
| [nats-protocol.md](nats-protocol.md) | The bus contract: subjects, request and reply formats, and the 17 commands. **When code and this document disagree, the document wins.** |

## 4. Contributing

Changing it.

| Document                                     | Contents                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)     | Setup, how the pieces fit, adding a command, tests, style, pull requests.                                                     |
| [architecture.md](architecture.md)           | How it works and why: the read/write split, how core processes a command, the two authentication planes, the shared packages. |
| [known-limitations.md](known-limitations.md) | What will surprise you, and the reasoning behind each one. **Worth reading before deploying.**                                |

---

## The short version

```
web ─────┐
         ├──HTTP──> api ──NATS──> core ──> PostgreSQL
opus-web ┘         (reads)  req/reply  (writes)
```

The API reads and serves HTTP; `core` is the only service that writes. **That is enforced by
database permissions, not by convention** — the API connects with a role that only holds
`SELECT`.

Two things to know before you try to run it:

- Starting the stack needs a NATS identity and two identity-provider service users that are
  **not in this repository** ([installation.md](installation.md)).
- Jiku does not create users. Someone who authenticates but is not in the `users` table
  gets a 401 ([known-limitations.md](known-limitations.md)).
