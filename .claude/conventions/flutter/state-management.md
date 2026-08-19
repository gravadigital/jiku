---
id: state-management
display_name: Estado (Riverpod + StateNotifier)
language: flutter
description: App state with Riverpod providers and StateNotifier, plus DI
applies_to: [frontend]
required_by: []
package: flutter_riverpod
---

# State Management (Flutter, Riverpod)

App state and dependency injection with [Riverpod](https://riverpod.dev). Shared/mutable state lives in `StateNotifier`s exposed through providers; widgets watch providers reactively. Riverpod also serves as the DI mechanism — services and repositories are provided, not constructed inline (no `get_it`).

## When to use

Always active for state shared across widgets or that outlives a single widget (session, orders, config). Purely local, ephemeral UI state (a text field, an expanded/collapsed flag) stays in a `StatefulWidget` — it does not need a provider.

## Package

```
flutter_riverpod
```

## Structure

```
lib/shared/
├── providers/                 # provider definitions (wiring)
│   ├── session_provider.dart
│   └── orders_provider.dart
└── state/                     # notifiers + state classes
    ├── session_notifier.dart
    └── orders_notifier.dart
```

`main.dart` wraps the app in a `ProviderScope`.

## Decision tree

| State scope | Use |
|---|---|
| Ephemeral, single widget | `StatefulWidget` + `setState` |
| Shared / outlives a widget, mutable | `StateNotifierProvider` (notifier in `shared/state/`) |
| Derived from other providers | a `Provider` that composes them |
| Async one-shot (init, fetch) | `FutureProvider` |
| Service / repository (DI) | `Provider` returning the instance |

## How to use

### Notifier + state

```dart
// lib/shared/state/session_notifier.dart
class SessionNotifier extends StateNotifier<SessionState> {
  SessionNotifier(this._service) : super(const SessionState());
  final SessionService _service;

  Future<void> pair(String code) async {
    state = state.copyWith(status: SessionStatus.pairing);
    try {
      final session = await _service.pair(code);
      state = state.copyWith(status: SessionStatus.paired, session: session);
    } on AppException catch (e) {
      state = state.copyWith(status: SessionStatus.error, error: e.message);
    }
  }
}
```

### Provider (wires the notifier + its deps)

```dart
// lib/shared/providers/session_provider.dart
final sessionServiceProvider = Provider((ref) => SessionService(ref.read(httpClientProvider)));

final sessionProvider = StateNotifierProvider<SessionNotifier, SessionState>(
  (ref) => SessionNotifier(ref.read(sessionServiceProvider)),
);
```

### Consuming in a widget

```dart
class PairingScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);            // reactive read
    // side-effects (navigation, snackbars) via ref.listen, not in build:
    ref.listen(sessionProvider, (prev, next) {
      if (next.status == SessionStatus.paired) context.go('/orders');
    });
    return ...;
  }
}
```

- `ref.watch` to react to state in `build`.
- `ref.read` for one-shot reads (callbacks, `initState`).
- `ref.listen` for side-effects (navigation, dialogs) — never trigger those inside `build`.

## Rules

- Shared state lives in a `StateNotifier`; its state class is immutable with `copyWith` (see `_base`).
- One provider per piece of state/service, in `shared/providers/`. Notifiers in `shared/state/`. No business logic in widgets.
- Services/repositories are obtained via providers (DI). Do not `new` a service inside a widget or another service.
- Widgets are `ConsumerWidget`/`ConsumerStatefulWidget` when they need providers.
- Side-effects use `ref.listen`; `build` stays pure (no navigation/IO in `build`).
- A notifier exposes intent methods (`pair`, `refresh`), not raw setters. State transitions happen inside the notifier.
- Dispose subscriptions/timers when the notifier is disposed; never update state after disposal.

## Framework variant

`Riverpod` code-gen (`riverpod_generator` + `@riverpod`) is an acceptable, more concise variant of the same model. `Bloc` is acceptable when the team standardizes on it; the rules (immutable state, intent methods, no logic in widgets, DI through the framework) still apply. Document the choice in the app README.

## Integration with other conventions

- **networking**: services/repositories consumed by notifiers are provided here.
- **navigation**: `ref.listen` drives route changes via the router.
- **error-handling**: notifiers catch domain exceptions and map them to an `error` field in state.
