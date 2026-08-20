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

### A pre-signed download URL outlives the request that produced it

Every read path answers with a redirect to a pre-signed storage URL. Once issued, that URL
grants access to the file **without any credential** until it expires, wherever it is copied
or forwarded. The only control is its lifetime, `download-url-ttl-seconds`. Keep it short.

Attachment identifiers are still sequential integers, but they are no longer enumerable
without credentials: every endpoint requires a bearer token, so an unauthenticated caller
gets `401` before any identifier is looked up and the response reveals nothing about which
ids exist. The list of authentication exemptions is empty — see *Authentication is
deny-by-default* below.

### Authentication is deny-by-default

`validateToken` is installed globally for every path, and exemptions are declared as an
explicit list in `api/config/public.ts`. **That list is empty**: no route of the API is
exempt, so a new endpoint is protected without its author doing anything.

Adding an entry there makes an endpoint reachable **without credentials**. It is a security
change and must be reviewed as one: only something that implements — and documents — its own
access control belongs on that list.

One asymmetry to know about: the exemption interface covers `GET`, `PATCH`, `POST` and
`DELETE`. A new `PUT` is **not** covered by the global installation and must declare
`validateToken` in its own middleware chain.
