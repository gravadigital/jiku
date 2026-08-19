---
id: auth-jwt
display_name: Autenticación JWT (golang-jwt)
language: golang
description: JWT verification middleware and identity propagation for APIs
applies_to: [api]
required_by: []
package: github.com/golang-jwt/jwt/v5
---

# Auth (Go, JWT)

Stateless authentication for APIs via JWT. Default: [golang-jwt](https://github.com/golang-jwt/jwt) to parse and verify tokens. For OIDC providers, [coreos/go-oidc](https://github.com/coreos/go-oidc) handles discovery and JWKS rotation. This convention covers **verifying** tokens at the boundary and propagating the identity; issuing tokens is the auth service's concern.

## When to use

`api` services that require authenticated requests. Public endpoints (`/health`, webhooks with their own signature) are explicitly exempted.

## Package

```
github.com/golang-jwt/jwt/v5
github.com/coreos/go-oidc/v3       # only when validating against an OIDC provider (JWKS)
```

## How to use

### Verification middleware

```go
// internal/http/middleware/auth.go
func Auth(verifier TokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := bearer(r.Header.Get("Authorization"))
			if raw == "" {
				writeError(w, r, errs.NewUnauthorized("missing token"))
				return
			}
			claims, err := verifier.Verify(r.Context(), raw)
			if err != nil {
				writeError(w, r, errs.NewUnauthorized("invalid token"))
				return
			}
			ctx := WithIdentity(r.Context(), Identity{UserID: claims.Subject, Roles: claims.Roles})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

> `verifier` and the `claims` it returns are **app-defined**: a small `TokenVerifier` that wraps `jwt.ParseWithClaims` with a custom claims struct (embedding `jwt.RegisteredClaims` plus app fields like `Roles`). `golang-jwt`'s `RegisteredClaims` has no `Roles` field of its own.

### Reading identity in a handler

```go
id, ok := auth.IdentityFrom(r.Context())
if !ok {
	writeError(w, r, errs.NewUnauthorized("no identity"))
	return
}
// authorization: check id.Roles / ownership before acting
```

## Rules

- Verify the signature **and** standard claims (`exp`, `iat`, `nbf`, `iss`, `aud`). Reject on any failure with `KindUnauthorized` (401).
- The signing key/JWKS comes from `config`; never hardcode keys. For asymmetric tokens, verify with the public key/JWKS only.
- **Authentication ≠ authorization.** The middleware proves *who*; handlers/services enforce *what they can do* (roles, ownership) and raise `KindForbidden` (403) when denied.
- Identity travels in `ctx` (typed accessor), never as a global or a handler field.
- Never log the token or full `Authorization` header (see `logging`).
- Clock skew tolerance is small and explicit (e.g., 30s). Expired tokens are rejected.
- Public routes are an explicit allowlist; everything else requires a valid token by default.

## Integration with other conventions

- **error-handling**: missing/invalid token → `KindUnauthorized`; permission denied → `KindForbidden`. Triggers `error-handling` via `required_by`.
- **http-server**: the middleware is registered before protected routes.
- **config**: JWKS URL / signing key / issuer / audience come from `Config`.
