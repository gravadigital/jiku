---
id: testing
display_name: Testing (flutter_test + mocktail)
language: flutter
description: Unit, widget, and provider tests with mocktail and ProviderScope overrides
applies_to: [frontend]
required_by: []
package: mocktail
---

# Testing (Flutter, mocktail)

Unit, widget, and provider tests with the built-in `flutter_test` plus [mocktail](https://pub.dev/packages/mocktail) for mocks (no codegen). Tests mirror `lib/`; dependencies are faked by overriding Riverpod providers.

## When to use

Every app. Unit tests for notifiers/services/mappers; widget tests for screens and reusable widgets; provider tests for state logic.

## Package

```
flutter_test            # SDK, dev
mocktail                # dev only, mocks without codegen
```

## Structure

`test/` mirrors `lib/`:

```
test/
├── shared/
│   ├── orders/orders_notifier_test.dart
│   └── services/...
├── screens/orders/orders_screen_test.dart
└── helpers/
    ├── pump_app.dart           # wraps a widget in ProviderScope + MaterialApp
    └── fakes.dart              # shared mocks/fakes
```

## How to use

### Mocking with mocktail

```dart
class MockOrdersRepository extends Mock implements OrdersRepository {}

test('loads orders', () async {
  final repo = MockOrdersRepository();
  when(() => repo.list()).thenAnswer((_) async => [fakeOrder()]);

  final container = ProviderContainer(overrides: [
    ordersRepositoryProvider.overrideWithValue(repo),
  ]);
  addTearDown(container.dispose);

  await container.read(ordersProvider.notifier).load();

  expect(container.read(ordersProvider).orders, hasLength(1));
});
```

### Widget test

```dart
testWidgets('shows empty state', (tester) async {
  await tester.pumpApp(           // helper: ProviderScope + MaterialApp
    const OrdersScreen(),
    overrides: [ordersProvider.overrideWith((_) => EmptyOrdersNotifier())],
  );
  expect(find.text('No hay pedidos'), findsOneWidget);
});
```

## Rules

- `test/` mirrors `lib/`. One test file per unit under test.
- Dependencies are faked by **overriding providers** in a `ProviderContainer`/`ProviderScope`, not by reaching into globals.
- Mocks use mocktail (`when`/`verify`); register fallback values for custom types with `registerFallbackValue`. No hand-rolled mock classes for non-trivial interfaces.
- Notifiers/services/mappers have unit tests; screens and shared widgets have widget tests. Critical flows may add integration tests (`integration_test/`).
- Always `addTearDown(container.dispose)` / dispose to avoid leaks across tests. No shared mutable state between tests.
- Tests are deterministic: no real network, no `Future.delayed` for sync; use `tester.pump`/`pumpAndSettle` and fake clocks.
- Assert on user-visible behavior (text, widget presence) in widget tests, not on private implementation.
- CI runs `flutter analyze` + `flutter test --coverage` (see `ci-gitlab`); the analyzer must be clean.

## Variant (current app)

The existing app uses hand-written mock classes (`implements X`) and manual fakes. That works but is verbose and brittle as interfaces grow; mocktail removes the boilerplate and makes stubbing/verification uniform. New tests use mocktail.

## Integration with other conventions

- **state-management**: provider overrides are the seam for injecting fakes.
- **networking**: repositories are mocked so tests never hit the network.
- **models-serialization**: generated `==` makes model assertions reliable.
