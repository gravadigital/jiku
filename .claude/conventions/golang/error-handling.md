---
id: error-handling
display_name: Manejo de errores
language: golang
description: Error modeling, wrapping, and canonical boundary shape
applies_to: [api, worker, cli, library]
required_by: [http-server, validation, messaging, auth-jwt]
package: null
---

# Error Handling (Go)

Defines how errors are modeled, wrapped, propagated, and translated at the boundary. Auto-included when `http-server`, `validation`, `messaging`, or `auth-jwt` are active, because they all need to agree on a common error shape.

## When to use

Any Go service that exposes an interface to the outside (HTTP API, message consumer). `cli`/`library` use the typing and wrapping rules but not necessarily the boundary translation.

## Sentinel vs typed errors

- **Sentinel errors** for simple, comparable conditions, in the package that owns them:

  ```go
  // internal/order/order.go
  var ErrNotFound = errors.New("order not found")
  ```

- **Typed errors** when the boundary needs a category (status, code) and optional details:

  ```go
  // internal/shared/errs/errs.go
  package errs

  type Kind string

  const (
  	KindValidation   Kind = "VALIDATION_ERROR"
  	KindNotFound     Kind = "NOT_FOUND"
  	KindUnauthorized Kind = "UNAUTHORIZED"
  	KindForbidden    Kind = "FORBIDDEN"
  	KindConflict     Kind = "CONFLICT"
  	KindInternal     Kind = "INTERNAL_ERROR"
  )

  type Error struct {
  	Kind    Kind
  	Message string
  	Details map[string]any
  	cause   error
  }

  func (e *Error) Error() string { return e.Message }
  func (e *Error) Unwrap() error { return e.cause }

  func NewValidation(msg string, details map[string]any) *Error {
  	return &Error{Kind: KindValidation, Message: msg, Details: details}
  }
  func NewNotFound(msg string) *Error { return &Error{Kind: KindNotFound, Message: msg} }
  // ... one constructor per kind
  ```

## Wrapping and inspection

- Wrap with `%w` adding context at each layer: `fmt.Errorf("create order: %w", err)`.
- Inspect with `errors.Is` (sentinels) and `errors.As` (typed):

  ```go
  if errors.Is(err, order.ErrNotFound) { ... }

  var appErr *errs.Error
  if errors.As(err, &appErr) { /* appErr.Kind, appErr.Details */ }
  ```

- Translate low-level errors to domain errors at the layer that has the context to do so (e.g., a repository maps "no rows" to `ErrNotFound`).

## When to use each kind

| Kind | When |
|---|---|
| `KindValidation` | Invalid input (structure, types, domain rules). |
| `KindNotFound` | Requested resource does not exist. |
| `KindUnauthorized` | No credentials or invalid credentials. |
| `KindForbidden` | Valid credentials, no permission for this action. |
| `KindConflict` | State prevents the operation (duplicate, already processed). |
| `KindInternal` | Anything unexpected (defaults to 500). |

## Canonical boundary shape

Every error response from the system follows this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is not valid",
    "details": { "field": "email" }
  }
}
```

- `code`: stable `SCREAMING_SNAKE_CASE` string, part of the public contract.
- `message`: human-readable, no sensitive info.
- `details`: optional, only info useful to the client. Never stack traces, queries, internal paths.

The status code maps from the `Kind`:

```go
// internal/http/middleware/error.go
func statusOf(kind errs.Kind) int {
	switch kind {
	case errs.KindValidation:   return http.StatusBadRequest
	case errs.KindNotFound:     return http.StatusNotFound
	case errs.KindUnauthorized: return http.StatusUnauthorized
	case errs.KindForbidden:    return http.StatusForbidden
	case errs.KindConflict:     return http.StatusConflict
	default:                    return http.StatusInternalServerError
	}
}
```

## Translation at the boundary

The transport convention (`http-server`, message consumer) implements one place that:

1. Receives any error returned by a handler/consumer.
2. If it unwraps to `*errs.Error`: responds with `code`, `status`, `message`, `details`.
3. Otherwise: responds `INTERNAL_ERROR` / 500 with a generic message; the real error is **logged**, never exposed.
4. Logs per `logging` (with stack/cause for internal errors; at `warn` without cause for expected domain errors).

## Rules

- Always return typed or sentinel errors from domain code. Never return a bare `errors.New("...")` that a caller is expected to branch on.
- Always wrap with `%w` when crossing a layer; never discard the cause with `%v` if a caller might need `errors.Is/As`.
- `code` values are part of the public contract — changing one is a breaking change.
- Never include sensitive data in `message`/`details` (passwords, tokens, other users' data, internals).
- 5xx errors are never remapped to 4xx to hide bugs; they are logged and surfaced as `INTERNAL_ERROR`.
- One canonical place per error: if the same condition arises in N places, extract a constructor/helper.
- Do not log AND return the same error at every layer (double logging). Log once, at the boundary.

## Integration with other conventions

- **http-server / messaging**: implement the boundary translation described here.
- **validation**: validation failures become `KindValidation` with field details.
- **logging**: the boundary handler logs the cause for internal errors.
