---
id: env-config
display_name: Configuración de entorno (flutter_dotenv)
language: flutter
description: Typed environment/config loaded at startup, per-flavor values
applies_to: [frontend]
required_by: []
package: flutter_dotenv
---

# Environment Config (Flutter, flutter_dotenv)

Runtime configuration (API base URL, feature flags, endpoints) is loaded at startup and exposed as a **typed object**, not read ad-hoc across the app. Default: [flutter_dotenv](https://pub.dev/packages/flutter_dotenv) with a `.env` file; `--dart-define` is the compile-time alternative for secrets/CI.

## When to use

Always. Even a single-environment app benefits from one typed config surface instead of scattered constants.

## Package

```
flutter_dotenv
```

## How to use

### Load at startup and wrap in a typed object

```dart
// lib/shared/config/env.dart
class Env {
  Env._(this.apiBaseUrl, this.natsUrl, this.debugPanel);
  final String apiBaseUrl;
  final String natsUrl;
  final bool debugPanel;

  factory Env.fromDotenv() => Env._(
        _required('API_BASE_URL'),
        _required('NATS_URL'),
        dotenv.env['DEBUG_PANEL'] == 'true',
      );

  static String _required(String k) {
    final v = dotenv.env[k];
    if (v == null || v.isEmpty) throw StateError('missing env $k');
    return v;
  }
}

final envProvider = Provider<Env>((_) => throw UnimplementedError()); // overridden in main
```

```dart
// main.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  final env = Env.fromDotenv(); // fails fast if a required var is missing
  runApp(ProviderScope(
    overrides: [envProvider.overrideWithValue(env)],
    child: const App(),
  ));
}
```

The rest of the app reads `ref.read(envProvider)`, never `dotenv.env[...]` directly.

## Rules

- Config is loaded and validated **once** at startup (fail fast on missing required values). The app consumes the typed `Env`, never `dotenv.env` directly.
- `.env` is **git-ignored**; a committed `.env.example` documents every key with safe placeholders.
- Secrets are never committed. For build-time secrets/CI, use `--dart-define`/`--dart-define-from-file` instead of a bundled `.env`.
- Declare `.env` in `pubspec.yaml` assets only for local/dev bundling; do not ship real secrets inside the app bundle.
- Feature flags and environment differences (dev/staging/prod) come from config, not from `kDebugMode` branches scattered in code.
- Never log the full config or secret values (see the app's logging approach).

## Variant

For multi-flavor builds, `--dart-define-from-file=config/{flavor}.json` (compile-time) avoids shipping a `.env` and integrates with Flutter flavors. The typed `Env` object stays the same; only the source changes. The current app uses `flutter_dotenv`.

## Integration with other conventions

- **networking**: `apiBaseUrl` and endpoints come from `Env`.
- **state-management**: `Env` is provided via `envProvider` (DI).
