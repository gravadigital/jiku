# Security policy

## Reporting a vulnerability

Please report security issues privately to **lautaro@grava.digital**. Do not open a public
issue for anything that could be exploited before there is a fix.

Include whatever you have: what the problem is, how to reproduce it, and which version or
commit you looked at. A proof of concept helps but is not required.

We will confirm receipt and tell you whether we consider it a vulnerability and what we
plan to do about it. If we disagree that it is a security issue, we will say so and
explain why.

## Supported versions

This project is at its first public release. Fixes land on the default branch; there are
no maintained release branches yet.

## Known limitations

These are documented rather than hidden, because they affect how you should deploy Jiku.
They are not vulnerabilities in themselves, but they shape the security of an installation.

### Authentication can be disabled for local development

Setting `AUTH_BYPASS=true` makes the API skip token validation and treat every request as
an administrator. It is an explicit opt-in, it is refused when `NODE_ENV=production`, and
every bypassed request is logged with a warning — but if you set it somewhere reachable,
that deployment is open. It exists so the stack can run without an identity provider.

### The API's read-only guarantee is enforced by the database

The API connects with a role that only has `SELECT`. That is what makes "the API does not
write" a guarantee rather than a convention, so **the read-only user has to be created
correctly**, including `ALTER DEFAULT PRIVILEGES` — otherwise tables created by future
migrations become invisible to the API. See `deploy/README.md`.

### Core trusts the message body for the end user's identity

The API connects to the bus with its own service user, so the user id in the subject is
the API's, not the end user's. The acting user travels in the message body (`creator` /
`author`) and core trusts it. This is safe because the access policy only lets the API
publish those commands — but if you add a second publisher to the bus, that assumption
stops holding.

### NATS credentials are handled manually

The bus identity (operator, accounts, sentinels) is generated once and placed on the
server by hand, outside git. There is no rotation mechanism yet.

### The `bus-observer` role reads every command

It exists for local debugging and can read the contents of every message on the bus,
including business data. The access policy file marks it as local-only. Do not grant it in
a production deployment.

### Attachment identifiers are sequential

`GET /api/opus/attachments/:id/public` requires no authentication by design: it serves
attachments explicitly marked public, and refuses anything else. Because identifiers are
sequential integers, someone can enumerate them to discover which attachments are public.
For large files it redirects to a pre-signed storage URL, which is then outside the
application's control until it expires.
