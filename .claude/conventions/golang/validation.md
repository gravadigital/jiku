---
id: validation
display_name: Validación de inputs (go-playground/validator)
language: golang
description: Input validation for request payloads and domain inputs
applies_to: [api, worker]
required_by: []
package: github.com/go-playground/validator/v10
---

# Validation (Go, go-playground/validator)

Validation of external input (HTTP bodies, message payloads, command args) before it reaches the domain. Default: [go-playground/validator](https://github.com/go-playground/validator) — struct-tag validation with a rich rule set and custom validators.

## When to use

Any boundary that accepts external input: `api` handlers, `worker` message payloads. Internal domain invariants that cannot be expressed as struct tags are enforced in the domain code itself.

## Package

```
github.com/go-playground/validator/v10
```

## Base configuration

```go
// internal/shared/validate/validate.go
package validate

import (
	"errors"

	"github.com/go-playground/validator/v10"

	"example.com/svc/internal/shared/errs"
)

var v = validator.New(validator.WithRequiredStructEnabled())

// Struct validates s and returns a *errs.Error (KindValidation) with field details.
func Struct(s any) error {
	if err := v.Struct(s); err != nil {
		var ve validator.ValidationErrors
		if errors.As(err, &ve) {
			details := map[string]any{"fields": fieldErrors(ve)}
			return errs.NewValidation("validation failed", details)
		}
		return err
	}
	return nil
}
```

`fieldErrors` maps each `FieldError` to `{field, rule}` so the response matches the canonical error shape (see `error-handling`).

## How to use

### Validating an input struct

```go
// internal/order/handler.go
type CreateOrderInput struct {
	CustomerID string  `json:"customerId" validate:"required,uuid4"`
	Total      float64 `json:"total" validate:"required,gt=0"`
	Currency   string  `json:"currency" validate:"required,oneof=USD EUR ARS"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, r, errs.NewValidation("invalid body", nil))
		return
	}
	if err := validate.Struct(in); err != nil {
		writeError(w, r, err)
		return
	}
	// ... in is safe to pass to the service
}
```

### Custom rules

Register reusable domain rules once at startup:

```go
v.RegisterValidation("not_blank", func(fl validator.FieldLevel) bool {
	return strings.TrimSpace(fl.Field().String()) != ""
})
```

## Rules

- Validate **at the boundary**, before the domain runs. The service can assume its input is structurally valid.
- One input struct per endpoint/message, with `validate` tags. Do not validate ad-hoc with scattered `if` checks.
- Validation failures map to `KindValidation` (status 400) with field-level `details` (see `error-handling`).
- Domain rules that need other entities or DB state are **not** struct-tag validations — enforce them in the service and raise the appropriate typed error.
- Keep validation messages free of sensitive values (don't echo secrets back).
- `oneof`/enums in tags must list the full set; keep them in sync with the domain enum.

## Integration with other conventions

- **error-handling**: validation errors are `KindValidation`; this convention triggers `error-handling` via `required_by`.
- **http-server / messaging**: call `validate.Struct` on the decoded payload before invoking the service.
