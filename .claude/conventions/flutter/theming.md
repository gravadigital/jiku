---
id: theming
display_name: Theming y design system
language: flutter
description: Centralized design tokens (color, typography, spacing) wired into ThemeData
applies_to: [frontend]
required_by: []
package: null
---

# Theming & Design System (Flutter)

A centralized design system: color, typography, spacing, radius, and elevation are defined as **tokens** in one place and exposed through `ThemeData`. Widgets read from the theme/tokens, never hardcode colors or sizes. This is the Flutter-side consumer of the product design system (the `product-ux` skills produce the source tokens).

## When to use

Always active. Every app has a design system, even a small one. Visual consistency and dark mode depend on it.

## Structure

```
lib/shared/theme/
├── app_theme.dart        # ThemeData factories (light/dark) from tokens
├── app_colors.dart       # color palette (semantic + status)
├── app_typography.dart   # TextStyle scale
├── app_spacing.dart      # spacing scale (4/8 base)
├── app_radius.dart       # border radii
└── app_shadows.dart      # elevation/shadows
```

## How to use

### Tokens

```dart
// lib/shared/theme/app_spacing.dart
abstract final class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}
```

```dart
// lib/shared/theme/app_colors.dart
abstract final class AppColors {
  static const primary = Color(0xFF3D4F7C);
  static const surface = Color(0xFF111111);
  static const success = Color(0xFF2E7D32);
  static const error   = Color(0xFFC62828);
  // semantic + status tokens; not raw values scattered in widgets
}
```

### ThemeData from tokens

```dart
// lib/shared/theme/app_theme.dart
abstract final class AppTheme {
  static ThemeData dark() => ThemeData(
        useMaterial3: true,
        colorScheme: const ColorScheme.dark(primary: AppColors.primary, error: AppColors.error),
        textTheme: AppTypography.textTheme,
      );
}
```

```dart
// main.dart
MaterialApp.router(theme: AppTheme.dark(), /* ... */);
```

### Consuming in widgets

```dart
final cs = Theme.of(context).colorScheme;
return Container(
  padding: const EdgeInsets.all(AppSpacing.md),
  decoration: BoxDecoration(color: cs.surface, borderRadius: AppRadius.card),
);
```

## Rules

- All colors, text styles, spacing, radii, and shadows come from tokens in `shared/theme/`. **No** hardcoded `Color(0x...)`, magic `EdgeInsets.all(13)`, or inline `TextStyle` in feature widgets.
- Semantic naming over raw values: `AppColors.error`, not `red`. Status/medical/brand colors are named tokens.
- Spacing follows a single scale (4 or 8 base). No arbitrary pixel values.
- Theme is built once and passed to `MaterialApp`. Dark mode (and light, if supported) are token-driven; respect `prefers`/system where applicable.
- Reusable primitives (buttons, cards, badges) live in `shared/widgets/` and consume tokens, so restyling happens in one place.
- Contrast meets the design system's target (see the product design-system guidelines). How the layout survives the user's text scale is not defined here — see the `adaptive-layout` convention.

## Integration with other conventions

- **adaptive-layout**: consumes these tokens and composes them with the device's system insets. Tokens define the values; that convention defines how the layout reacts to safe areas, text scaling and size classes.
- **product design system**: the tokens here mirror the source design-system tokens produced by the `product-ux` skills. Keep them in sync.
- **_base**: token classes are `abstract final` with `static const` members (no instances).
