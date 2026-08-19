---
id: adaptive-layout
display_name: Layout adaptativo (safe areas, escalado, tamaños)
language: flutter
description: How a layout adapts to the device — safe areas, text scaling, size classes and orientation
applies_to: [frontend]
required_by: []
package: null
---

# Adaptive Layout (Flutter)

How a screen adapts to the device it runs on. In a phone app there is normally **one** layout: what varies is not the width but the system insets that eat into it, the text scale the user chose, and — only if the product supports tablets — the size class. This convention covers how to implement those with the SDK primitives. The values it reacts to are not defined here: they live in the surface's design system, in `docs/design-system/{surface}/foundations/grid.md`.

## When to use

- Any Flutter app: safe areas and text scaling apply to every screen, on every device.
- Screens anchored to an edge (bottom navigation, fixed CTA, floating action button) — the highest-risk case.
- Screens with a form, where the keyboard changes the available height.
- Apps whose surface declares more than one viewport (`phone` + `tablet`) and therefore need real size-class layouts.

## Package

No package. `SafeArea`, `MediaQuery`, `LayoutBuilder` and `OrientationBuilder` ship with the SDK and cover every case below.

Deliberately **not** used: packages that scale every dimension by screen ratio (`flutter_screenutil` and similar). They fight the design system's token scale, they break user text scaling — the value scales with the screen instead of with the user's accessibility setting — and once adopted they shape every widget in the codebase.

## How to use

### One layout unless the spec says otherwise

Read the screen's spec before adding any adaptivity. `docs/ux/surfaces/{surface}/screens/{screen}.md` declares its `viewports` and a `Layout por viewport` section. If it declares a single viewport, build a single layout: no `LayoutBuilder`, no width checks, no orientation branches.

```dart
// lib/features/trips/presentation/active_trip_page.dart
// screen.md declares viewports: [phone] -> one layout, no size-class branching
class ActiveTripPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(children: [ /* ... */ ]),
      ),
    );
  }
}
```

Adding breakpoints a phone-only app does not have is not thoroughness: it is untested code paths and a layout nobody specified.

### Safe areas

`SafeArea` for the common case — it insets its child by the system padding and is the correct default for the body of a screen.

```dart
// lib/features/trips/presentation/active_trip_page.dart
Scaffold(
  body: SafeArea(
    child: TripDetails(),
  ),
  // A bottom bar must not be wrapped in the body's SafeArea: it needs the
  // bottom inset applied to itself, or it renders under the home indicator.
  bottomNavigationBar: SafeArea(
    top: false,
    child: AppBottomNav(),
  ),
)
```

Read `MediaQuery` directly only when the inset has to be composed with your own spacing instead of just applied:

```dart
// lib/shared/widgets/sticky_action_bar.dart
final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

return Padding(
  padding: EdgeInsets.only(
    left: AppSpacing.md,
    right: AppSpacing.md,
    bottom: AppSpacing.md + bottomInset, // token spacing PLUS the system inset
  ),
  child: PrimaryButton(label: 'Confirmar'),
);
```

### The keyboard

The keyboard is a separate inset (`viewInsets`), not part of `viewPadding`. A form whose submit button sits at the bottom must stay reachable while the keyboard is up.

```dart
// lib/features/orders/presentation/new_order_page.dart
Scaffold(
  // Default is true; keep it. Setting it to false is what hides inputs
  // behind the keyboard.
  resizeToAvoidBottomInset: true,
  body: SafeArea(
    child: SingleChildScrollView(
      // Extra bottom room so the last field and the submit button can be
      // scrolled clear of the keyboard.
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: OrderForm(),
    ),
  ),
)
```

### Text scaling

The user's text scale is an accessibility setting, and the layout has to survive the maximum the design system declares (typically 200%). In practice this means: no fixed heights on anything containing text, and text that wraps instead of being clipped.

```dart
// lib/shared/widgets/order_card.dart
// WRONG: at 200% the text overflows a 72px box and gets clipped.
SizedBox(height: 72, child: Text(order.customerName));

// RIGHT: a minimum height, free to grow.
ConstrainedBox(
  constraints: const BoxConstraints(minHeight: 72),
  child: Text(order.customerName),
);
```

For a row where one side is text, let the text take the remaining space and wrap:

```dart
// lib/shared/widgets/order_row.dart
Row(
  children: [
    const Icon(Icons.receipt_long),
    const SizedBox(width: AppSpacing.sm),
    Expanded(child: Text(order.title)), // wraps instead of overflowing
    OrderStatusBadge(status: order.status),
  ],
)
```

When a row of controls cannot survive scaling side by side, `Wrap` degrades to stacked instead of clipping:

```dart
// lib/features/orders/presentation/order_actions.dart
Wrap(
  spacing: AppSpacing.sm,
  runSpacing: AppSpacing.sm,
  children: [ConfirmButton(), CancelButton()],
)
```

Cap the scale only if the design system says so, and never below the declared maximum:

```dart
// lib/app.dart
MaterialApp(
  builder: (context, child) {
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 2.0);
    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: scaler),
      child: child!,
    );
  },
)
```

### Size classes (only when the app supports tablet)

When the surface declares `phone` + `tablet`, the switch point comes from the grid foundation, in dp. Use `LayoutBuilder` scoped to the widget that actually changes — not `MediaQuery.size` read at the root of the app, which rebuilds the whole tree and reports the window rather than the space the widget was given.

```dart
// lib/shared/layout/size_class.dart
enum SizeClass { compact, expanded }

// Threshold from docs/design-system/{surface}/foundations/grid.md
const double kExpandedMinWidth = 600;

SizeClass sizeClassOf(double width) =>
    width >= kExpandedMinWidth ? SizeClass.expanded : SizeClass.compact;
```

```dart
// lib/features/trips/presentation/active_trip_page.dart
LayoutBuilder(
  builder: (context, constraints) {
    // Each branch mirrors one subsection of the screen.md's
    // "Layout por viewport" — same blocks, different arrangement.
    return switch (sizeClassOf(constraints.maxWidth)) {
      SizeClass.compact => const _TripLayoutPhone(),
      SizeClass.expanded => const _TripLayoutTablet(),
    };
  },
)
```

The two branches share the same widgets and the same content. If a branch needs different data or different copy, the divergence belongs in the screen spec first — it is a UX decision, not a layout detail.

### Orientation

The surface's orientation policy lives in the grid foundation. When it says portrait-locked, lock it once at startup rather than defending against rotation in every screen:

```dart
// lib/main.dart
await SystemChrome.setPreferredOrientations([
  DeviceOrientation.portraitUp,
]);
```

When the policy allows rotation for specific screens, only those screens handle it, and only if their `screen.md` declares a `phone-landscape` viewport:

```dart
// lib/features/scanner/presentation/scanner_page.dart
OrientationBuilder(
  builder: (context, orientation) => orientation == Orientation.landscape
      ? const _ScannerLandscape()
      : const _ScannerPortrait(),
)
```

## Touch targets

The minimum touch target is independent of the visual size of what is drawn. An icon of 24dp still needs a 48dp target.

| Platform | Minimum |
|---|---|
| Android (Material) | 48×48 dp |
| iOS (Cupertino) | 44×44 pt |

```dart
// lib/shared/widgets/icon_action.dart
// Do NOT enlarge the icon to reach the minimum: enlarge the target.
IconButton(
  iconSize: 24,
  constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
  onPressed: onTap,
  icon: const Icon(Icons.close),
)
```

## Testing

Two widget tests per screen cover the regressions this convention exists to prevent, and both are cheap:

```dart
// test/features/trips/active_trip_page_test.dart
testWidgets('bottom nav clears the home indicator inset', (tester) async {
  tester.view.padding = const FakeViewPadding(bottom: 34 * 3); // notched device
  addTearDown(tester.view.reset);

  await tester.pumpWidget(const App());

  final navBottom = tester.getBottomLeft(find.byType(AppBottomNav)).dy;
  final safeBottom = tester.view.physicalSize.height - tester.view.padding.bottom;
  expect(navBottom, lessThanOrEqualTo(safeBottom));
});

testWidgets('survives the maximum declared text scale', (tester) async {
  tester.platformDispatcher.textScaleFactorTestValue = 2.0;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  await tester.pumpWidget(const App());

  expect(tester.takeException(), isNull); // no overflow
});
```

## Rules

1. Read the screen's `viewports` and `Layout por viewport` before writing layout code. Implement what it declares — no more.
2. Never add size-class branching, width checks or orientation branches to a screen whose spec declares a single viewport.
3. Every screen body is inside a `SafeArea`, or applies `MediaQuery.viewPaddingOf` explicitly when it needs to compose the inset with token spacing.
4. Any widget anchored to an edge — bottom navigation, fixed CTA, FAB — applies the bottom inset to itself. Wrapping only the body is not enough.
5. Never hardcode the height of a status bar, notch or home indicator. Those come from `MediaQuery`.
6. Keep `resizeToAvoidBottomInset: true`, and give scrollable forms extra bottom padding from `viewInsets` so the last field and its submit button stay reachable.
7. No fixed heights on widgets containing text. Use `BoxConstraints(minHeight:)`, `Expanded` or `Wrap`.
8. The layout must render without overflow at the maximum text scale declared in the surface's grid foundation.
9. Clamp the text scaler only if the design system declares a cap, and never below that declared maximum.
10. Size-class thresholds are read in dp from `docs/design-system/{surface}/foundations/grid.md`. Never invent a breakpoint at implementation time, and never express one in pixels.
11. Use `LayoutBuilder` scoped to the widget that adapts. Do not branch on `MediaQuery.size` at the root of the app.
12. Both branches of a size-class layout render the same blocks with the same content. Divergence in data or copy is a UX decision and goes to the screen spec first.
13. Lock orientation once at startup when the grid foundation says portrait-locked. Use `OrientationBuilder` only in screens whose spec declares a `phone-landscape` viewport.
14. Touch targets meet the platform minimum (48dp Android / 44pt iOS) by expanding the target, never by enlarging the icon.

## Integration with other conventions

- **theming**: supplies the spacing, type and size tokens this convention composes with system insets. Tokens define the values; this convention defines how the layout reacts to the device.
- **navigation**: the shell that hosts bottom navigation or a persistent side panel is where rules 4 and 11 apply — it is the widget that changes with the size class.
- **testing**: the two widget tests above (safe-area inset and maximum text scale) belong to the screen's test file, following that convention's structure.
- **i18n**: translated strings are longer than the originals, which compounds with text scaling. A layout that survives rule 8 usually survives translation too.
