---
id: navigation
display_name: Navegación (go_router)
language: flutter
description: Declarative, URL-based routing with typed routes and guards
applies_to: [frontend]
required_by: []
package: go_router
---

# Navigation (Flutter, go_router)

Declarative routing with [go_router](https://pub.dev/packages/go_router): a single route table, URL-based navigation, deep links, and redirect guards. Routes are centralized, not scattered across `Navigator.push` calls.

## When to use

Always active for any app with more than a couple of screens. The default below replaces ad-hoc `MaterialApp.routes` maps (see `## Variant`).

## Package

```
go_router
```

## Structure

```
lib/shared/
└── router/
    ├── app_router.dart        # the GoRouter instance + route table
    └── routes.dart            # route path constants
```

## Base configuration

```dart
// lib/shared/router/routes.dart
abstract final class Routes {
  static const modeSelection = '/';
  static const pairing = '/pairing';
  static const orders = '/orders';
  static const orderDetail = '/orders/:id';
}
```

```dart
// lib/shared/router/app_router.dart
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: Routes.modeSelection,
    // re-run `redirect` when the session changes (adapt the provider to a Listenable):
    refreshListenable: ref.watch(routerRefreshProvider),
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final atPairing = state.matchedLocation == Routes.pairing;
      if (session.status != SessionStatus.paired && !atPairing) {
        return Routes.pairing; // guard: force pairing first
      }
      return null;
    },
    routes: [
      GoRoute(path: Routes.modeSelection, builder: (_, __) => const ModeSelectionScreen()),
      GoRoute(path: Routes.pairing, builder: (_, __) => const PairingScreen()),
      GoRoute(path: Routes.orders, builder: (_, __) => const OrdersScreen()),
      GoRoute(
        path: Routes.orderDetail,
        builder: (_, state) => OrderDetailScreen(id: state.pathParameters['id']!),
      ),
    ],
    errorBuilder: (_, state) => NotFoundScreen(location: state.uri.toString()),
  );
});
```

```dart
// main.dart
MaterialApp.router(routerConfig: ref.watch(routerProvider));
```

## How to use

```dart
context.go(Routes.orders);                 // replace stack (navigate)
context.push(Routes.orderDetail.replaceAll(':id', id)); // push on top
context.pop();                              // back
```

- Navigation triggered by state changes uses `ref.listen` in a `ConsumerWidget` (see `state-management`), or a `refreshListenable`/`redirect` wired to the relevant provider.

## Rules

- One route table in `shared/router/`. No `Navigator.push(MaterialPageRoute(...))` scattered in widgets.
- Route paths are **constants** in `routes.dart`. No hardcoded path strings at call sites.
- Auth/session gating is done with `redirect` guards, not by conditionally rendering screens.
- Deep-link parameters come from `state.pathParameters`/`state.uri.queryParameters`, validated before use.
- A 404/unknown route maps to an explicit `errorBuilder` screen.
- Navigation as a side-effect of state lives in `ref.listen`, never in `build`.

## Variant (current app)

The existing app uses `MaterialApp(routes: {...})` with `Navigator.pushNamed`/`pushAndRemoveUntil`. That works for small apps but does not scale to guards, deep links, or nested navigation. When migrating, move the route map into a `GoRouter` table and replace `Navigator.pushNamed` with `context.go/push`. New apps start with go_router.

## Integration with other conventions

- **state-management**: guards read providers (`sessionProvider`); screens navigate via `ref.listen`.
- **_base**: route param values feed screens whose inputs are validated.
