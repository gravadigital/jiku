---
id: models-serialization
display_name: Modelos y serialización (freezed + json_serializable)
language: flutter
description: Immutable models with generated copyWith, equality, and JSON (de)serialization
applies_to: [frontend]
required_by: []
package: freezed
---

# Models & Serialization (Flutter, freezed + json_serializable)

Immutable data models with [freezed](https://pub.dev/packages/freezed) (copyWith, equality, unions) and [json_serializable](https://pub.dev/packages/json_serializable) (JSON mapping). Codegen removes hand-written `fromJson`/`copyWith`/`==` boilerplate and the bugs that come with it.

## When to use

Always active for domain models and API DTOs. Trivial value objects without serialization can be plain `@immutable` classes (see `_base`), but anything (de)serialized or copied uses freezed.

## Package

```
freezed_annotation          # runtime
json_annotation             # runtime
freezed                     # dev only (codegen)
json_serializable           # dev only (codegen)
build_runner                # dev only (runs codegen)
```

## How to use

### A model

```dart
// lib/shared/models/order.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'order.freezed.dart';
part 'order.g.dart';

@freezed
abstract class Order with _$Order {
  const factory Order({
    required String id,
    @JsonKey(name: 'customer_id') required String customerId,
    required OrderStatus status,
    @Default(<OrderItem>[]) List<OrderItem> items,
    DateTime? deliveredAt,
  }) = _Order;

  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);
}

enum OrderStatus { pending, inProgress, done, cancelled }
```

This generates `copyWith`, `==`/`hashCode`, `toString`, `toJson`, and `fromJson`. Wire names that differ from the Dart field use `@JsonKey(name: 'customer_id')` — fields stay `camelCase` (no `snake_case` Dart identifiers). On freezed 3.x the class must be `abstract` (or `sealed`).

### Running codegen

```bash
dart run build_runner build --delete-conflicting-outputs
# during development:
dart run build_runner watch --delete-conflicting-outputs
```

### Domain vs API models

When the API shape differs from the domain shape, keep two models and map between them, rather than leaking transport quirks into the UI:

```dart
// lib/shared/models/order_dto.dart  ->  Order (domain)
extension OrderDtoX on OrderDto {
  Order toDomain() => Order(
        id: id,
        customerId: customerId, // DTO fields are camelCase; @JsonKey maps the wire name
        status: status.toDomain(),
      );
}
```

## Rules

- Models are immutable. No mutable fields, no setters. Updates via the generated `copyWith`.
- Generated files (`*.freezed.dart`, `*.g.dart`) are **committed** and never edited by hand. Re-run codegen after changing a model.
- Enums (de)serialized from the API use `@JsonValue('...')` to pin wire values; never rely on enum index/order.
- Dates are `DateTime` in memory, ISO 8601 UTC at the boundary (see `_base`). Use a converter when the API format differs.
- When API and domain shapes diverge, use a DTO + a mapping extension. Do not pollute domain models with API-only fields.
- `fromJson` tolerates missing optional fields (defaults via `@Default`); it fails loudly on missing required fields.

## Variant (current app)

The existing app defines models manually with `fromJson` factories, `copyWith`, and `==` written by hand. That is acceptable for a handful of small models but error-prone as they grow (forgotten field in `copyWith`/`==`). New models use freezed; migrate hot-spots opportunistically.

## Integration with other conventions

- **networking**: repositories return domain models; DTO→domain mapping lives at that layer.
- **state-management**: state classes can themselves be freezed (`@freezed` with `copyWith`).
- **testing**: generated `==` makes model assertions reliable.
