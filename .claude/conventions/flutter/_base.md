---
id: _base
display_name: Convenciones generales
language: flutter
description: Base conventions for any Flutter app (always active)
applies_to: [frontend]
required_by: []
package: flutter
---

# Base Conventions (Flutter)

This convention is **always included** when the service is a Flutter app. It defines what does not vary across features: Dart baseline, project layout, naming, immutability, and async rules.

## Dart baseline

- Latest stable Flutter/Dart. Pin in `pubspec.yaml` (`environment: sdk`) and CI.
- Sound null safety everywhere. No `// @dart` opt-outs.
- Lints enabled via `analysis_options.yaml` (see `testing` and the project lint set). The analyzer runs clean — warnings are not ignored.
- Format with `dart format` (line length 80 unless the project sets otherwise). Unformatted code does not merge.

## Project structure (feature-first + shared)

```
lib/
├── main.dart                  # entry: bootstrap, env load, ProviderScope, MaterialApp
├── screens/                   # one folder per feature
│   └── {feature}/
│       ├── {feature}_screen.dart
│       └── widgets/           # widgets used only by this feature
└── shared/                    # cross-cutting, reused across features
    ├── models/                # domain models / DTOs
    ├── providers/             # Riverpod providers (see state-management)
    ├── state/                 # StateNotifiers + state classes
    ├── services/              # data + integration logic (see networking)
    ├── theme/                 # design system (see theming)
    ├── i18n/                  # localization (see i18n)
    ├── utils/                 # pure helpers
    └── widgets/               # reusable UI components (buttons/, cards/, ...)
```

- **`screens/{feature}/`**: a screen plus the widgets used **only** by that feature (in its `widgets/`). Shared widgets go to `shared/widgets/`.
- **`shared/`**: anything reused across features, grouped by purpose (not by feature).
- Conventions like `state-management`, `networking`, `theming` populate their respective `shared/` subfolders.

## Naming

| Element | Convention | Example |
|---|---|---|
| Files | `snake_case` | `orders_screen.dart`, `session_notifier.dart` |
| Classes / enums | `PascalCase` | `OrdersScreen`, `OrderStatus` |
| Members, variables | `camelCase` | `currentUser`, `fetchOrders` |
| Constants | `camelCase` (`lowerCamelCase`) | `defaultTimeout`, `maxRetries` |
| Screens | `*Screen` suffix | `OrdersScreen`, `PairingScreen` |
| Reusable widgets | descriptive, no suffix needed | `OrderCard`, `PrimaryButton` |
| State classes | `*State` suffix | `OrdersState`, `SessionState` |
| Notifiers | `*Notifier` suffix | `OrdersNotifier` |
| Providers | `*Provider` suffix | `ordersProvider`, `sessionProvider` |
| Services | `*Service` suffix | `OrdersService` |
| Repositories | `*Repository` suffix | `OrderRepository` |

Dart constants use `lowerCamelCase`, not `SCREAMING_SNAKE` (Dart style).

## Immutability

- Model and state classes are **immutable** (`final` fields, `const` constructors where possible).
- Updates create a new instance via `copyWith`. For "set to null" cases, use explicit `clear*` flags in `copyWith` (a nullable param can't distinguish "unset" from "set to null").
- Prefer `const` constructors for widgets to let Flutter skip rebuilds.

```dart
@immutable
class SearchState {
  const SearchState({this.query = '', this.selectedId});

  final String query;
  final String? selectedId;

  SearchState copyWith({String? query, bool clearSelectedId = false, String? selectedId}) {
    return SearchState(
      query: query ?? this.query,
      selectedId: clearSelectedId ? null : (selectedId ?? this.selectedId),
    );
  }
}
```

## Async

- `async/await` over raw `.then()`.
- UI never blocks: long work is awaited off the build method (in notifiers/services), with explicit loading/error state.
- Handle cancellation/disposal: cancel subscriptions and timers in `dispose()`/notifier disposal. No work after a widget/notifier is disposed.

## Imports

- **Package-absolute** imports within the app: `import 'package:{app}/shared/...';`. No deep `../../../` relative imports across features.
- Relative imports only within the same folder/feature (`./widgets/order_card.dart`).
- Order: Dart SDK, Flutter, external packages, then `package:{app}/...`. Separate groups with a blank line (the linter enforces ordering).

## Comments

- Default: no comments. Clear names explain the code.
- Comment **only the why** when not obvious (platform quirk, workaround, ordering requirement).
- `///` doc comments on public APIs of shared widgets/services. No `// TODO` without an associated issue.
