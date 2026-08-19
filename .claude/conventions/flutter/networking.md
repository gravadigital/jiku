---
id: networking
display_name: Networking (dio + repository)
language: flutter
description: HTTP client, repository layer, interceptors, and error mapping
applies_to: [frontend]
required_by: []
package: dio
---

# Networking (Flutter, dio + repository)

Data access through a typed HTTP client ([dio](https://pub.dev/packages/dio)) wrapped by a **repository** per domain. Widgets and notifiers depend on repositories (interfaces), never on the raw client. Cross-cutting concerns (base URL, auth header, logging, error mapping) live in interceptors.

## When to use

Any app that talks to a backend over HTTP. For real-time transports (WebSocket/NATS), see `## Real-time variant` — the repository pattern is the same, only the client changes.

## Package

```
dio                  # HTTP client
```

## Structure

```
lib/shared/
├── services/
│   ├── http_client.dart        # configured Dio (base URL, interceptors)
│   └── interceptors/
│       ├── auth_interceptor.dart
│       └── error_interceptor.dart
└── {domain}/
    ├── {domain}_repository.dart      # interface (the port)
    └── {domain}_repository_impl.dart # uses Dio + maps DTO -> domain
```

## How to use

### Configured client (provided via Riverpod)

```dart
// lib/shared/services/http_client.dart
final httpClientProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: ref.read(envProvider).apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));
  dio.interceptors.addAll([
    AuthInterceptor(ref),     // attaches bearer token
    ErrorInterceptor(),       // maps DioException -> AppException
  ]);
  return dio;
});
```

### Repository (interface + impl)

```dart
// lib/shared/orders/orders_repository.dart
abstract interface class OrdersRepository {
  Future<List<Order>> list();
  Future<Order> getById(String id);
}

// lib/shared/orders/orders_repository_impl.dart
class OrdersRepositoryImpl implements OrdersRepository {
  OrdersRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Order> getById(String id) async {
    final res = await _dio.get('/orders/$id');
    return OrderDto.fromJson(res.data as Map<String, dynamic>).toDomain();
  }
}

final ordersRepositoryProvider = Provider<OrdersRepository>(
  (ref) => OrdersRepositoryImpl(ref.read(httpClientProvider)),
);
```

### Error mapping (interceptor)

```dart
// turns transport errors into domain AppExceptions (see error-handling)
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException e, ErrorInterceptorHandler handler) {
    handler.reject(DioException(
      requestOptions: e.requestOptions,
      error: AppException.fromResponse(e.response?.statusCode, e.response?.data),
    ));
  }
}
```

## Rules

- Notifiers/widgets depend on a **repository interface**, never on `Dio` directly. The client is an implementation detail behind the repository.
- One repository per domain, provided via Riverpod (see `state-management`).
- Base URL, timeouts, and the auth header come from interceptors + `env-config` — never hardcoded per call.
- Repositories return **domain models**; DTO→domain mapping happens at this layer (see `models-serialization`). Transport types do not leak to the UI.
- Transport errors are mapped to domain `AppException`s in an interceptor (see `error-handling`). Widgets handle domain errors, not `DioException`.
- Every request has explicit timeouts. Cancel in-flight requests on dispose when relevant (`CancelToken`).
- Never log full responses or auth headers.

## Real-time variant

When the app uses a real-time transport (WebSocket, or NATS via a Dart client), the **repository/service pattern is unchanged**: a `{domain}Service` wraps the connection, exposes a typed `Stream`/methods, maps payloads to domain models, and is provided via Riverpod. Connection lifecycle (connect, reconnect, dispose) lives in one injected singleton service. Document the transport in the app README. (The current app uses this model with a NATS client via the `dast` package — `http` is a dependency but not actually used in `lib/`.)

## Integration with other conventions

- **models-serialization**: repositories map DTOs to domain models.
- **error-handling**: interceptors translate transport errors to `AppException`.
- **state-management**: repositories are provided and consumed by notifiers.
- **env-config**: base URL and endpoints come from the typed env.
