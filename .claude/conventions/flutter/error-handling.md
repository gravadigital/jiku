---
id: error-handling
display_name: Manejo de errores
language: flutter
description: Domain exception model, mapping from transport, and UI error surfaces
applies_to: [frontend]
required_by: [networking]
package: null
---

# Error Handling (Flutter)

Defines how errors are modeled in the app, mapped from transport, surfaced in the UI, and never crash the user. Auto-included when `networking` is active, since the data layer is where most failures originate.

## When to use

Always when the app talks to a backend or has fallible operations. Pure presentational apps with no IO can skip the transport mapping but still use error boundaries.

## Domain exception model

```dart
// lib/shared/errors/app_exception.dart
sealed class AppException implements Exception {
  const AppException(this.message);
  final String message;
}

class NetworkException extends AppException {        // no connectivity / timeout
  const NetworkException([super.message = 'network error']);
}
class NotFoundException extends AppException {
  const NotFoundException([super.message = 'not found']);
}
class UnauthorizedException extends AppException {
  const UnauthorizedException([super.message = 'unauthorized']);
}
class ValidationException extends AppException {
  const ValidationException(super.message, this.fields);
  final Map<String, String> fields;
}
class UnexpectedException extends AppException {
  const UnexpectedException([super.message = 'unexpected error']);
}
```

A `sealed` class lets `switch` over exception types be exhaustive.

## Mapping from transport

The `networking` error interceptor turns transport errors into `AppException`s:

```dart
// declared inside `sealed class AppException` (a factory may return subtypes):
factory AppException.fromResponse(int? status, dynamic body) {
  return switch (status) {
    401 => const UnauthorizedException(),
    404 => const NotFoundException(),
    400 => ValidationException(_msg(body), _fields(body)),
    null => const NetworkException(),
    _   => const UnexpectedException(),
  };
}
```

## Surfacing in the UI

- **Notifiers** catch `AppException` and put it in state (`error` field), never rethrow into `build`:

  ```dart
  try {
    final orders = await _repo.list();
    state = state.copyWith(orders: orders, status: Status.ready);
  } on AppException catch (e) {
    state = state.copyWith(status: Status.error, error: e.message);
  }
  ```

- **Widgets** render the error state explicitly (inline message, retry button), not a blank screen.
- A top-level `ErrorWidget.builder` / zone guard catches anything unhandled and shows a safe fallback instead of a red screen in release.

## Rules

- Domain errors are `AppException` subtypes. Widgets and notifiers handle `AppException`, never raw `DioException`/platform exceptions.
- Transport errors are mapped to `AppException` at the data layer (see `networking`), not in widgets.
- Notifiers catch and translate to an `error` state; `build` never throws. No `try/catch` swallowing without surfacing.
- Every async UI action has a visible loading, success, and error state. No silent failures.
- User-facing error messages are localized (see `i18n`) and free of sensitive/internal detail (no stack traces, URLs, tokens).
- Unexpected errors are logged/reported (e.g., Sentry/Crashlytics when configured) and shown as a generic message.
- `ValidationException.fields` drives inline field errors on forms.

## Integration with other conventions

- **networking**: maps transport errors to `AppException` (this convention is required by it).
- **state-management**: notifiers store the error in immutable state.
- **i18n**: messages shown to the user are translation keys.
