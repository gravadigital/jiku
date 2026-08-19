---
id: testing
display_name: Testing (testify + table-driven)
language: golang
description: Unit and integration testing, table-driven tests, interface mocks, testcontainers
applies_to: [api, worker, cli, library]
required_by: []
package: github.com/stretchr/testify
---

# Testing (Go, testify)

Unit and integration testing with the standard `testing` package plus [testify](https://github.com/stretchr/testify) for assertions. Tests are **table-driven**, dependencies are faked through the small interfaces defined by each module, and integration tests run against real dependencies via [testcontainers](https://golang.testcontainers.org) (or an in-process server).

## When to use

Every service and library. Unit tests are mandatory for domain logic; integration tests for adapters (repositories, consumers, HTTP).

## Package

```
github.com/stretchr/testify            # assert + require
github.com/testcontainers/testcontainers-go  # integration (optional)
```

## Structure

- Tests live next to the code: `order/service_test.go` beside `order/service.go`.
- Black-box package by default: `package order_test` (tests the public API). Use `package order` only when testing unexported internals.
- Shared fixtures/builders in `internal/{module}/testdata` or a small `*_test.go` helper.

## How to use

### Table-driven unit test

```go
// internal/order/service_test.go
package order_test

func TestService_Create(t *testing.T) {
	tests := []struct {
		name    string
		input   order.CreateOrderInput
		wantErr error
	}{
		{name: "valid", input: validInput(), wantErr: nil},
		{name: "zero total", input: zeroTotal(), wantErr: order.ErrInvalidTotal},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := order.NewService(&fakeRepo{})
			_, err := svc.Create(context.Background(), tt.input)

			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}
```

`require` stops the test on failure (use for preconditions); `assert` continues (use for independent checks).

### Faking dependencies

Implement the module's small interface with a hand-written fake (preferred for simple cases):

```go
type fakeRepo struct {
	getFn func(ctx context.Context, id string) (order.Order, error)
}

func (f *fakeRepo) GetByID(ctx context.Context, id string) (order.Order, error) {
	return f.getFn(ctx, id)
}
```

For large interfaces, generated mocks (`mockery`/`uber-go/mock`) are acceptable; pin the tool and commit generated code. Keep mocks close to the consumer.

### Integration test with testcontainers

```go
func TestPGRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("integration")
	}
	ctx := context.Background()
	pg, err := postgres.Run(ctx, "postgres:16-alpine")
	require.NoError(t, err)
	t.Cleanup(func() { _ = pg.Terminate(ctx) })
	// ... run migrations, exercise the repository against the real DB
}
```

Gate integration tests behind `testing.Short()` so `go test -short` runs only unit tests.

## Rules

- Tests are table-driven when there is more than one case for the same behavior.
- One behavior per test function; the name says what it asserts (`TestService_Create_RejectsZeroTotal`).
- Domain logic is tested in isolation through the module's interfaces. No network/DB in unit tests.
- Adapters (repository, consumer, HTTP) get integration tests against real dependencies (testcontainers or in-process server), gated by `testing.Short()`.
- Use `t.Cleanup` for teardown and `t.Helper()` in helpers. No global test state shared across tests.
- Run the suite with `-race` in CI. Data races fail the build.
- Assert error identity with `require.ErrorIs`/`ErrorAs`, never by comparing error strings.
- No `time.Sleep` to synchronize; use channels, `assert.Eventually`, or deterministic clocks.

## Integration with other conventions

- **error-handling**: tests assert on typed/sentinel errors via `ErrorIs`/`ErrorAs`.
- **database / messaging**: their adapters are covered by integration tests.
- **ci-gitlab**: the pipeline runs `go test -race -short` (unit) and the full suite (integration) per the CI convention.
