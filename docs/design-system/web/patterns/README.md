# Patterns (web)

> Los patterns son composiciones de componentes que resuelven un caso de uso recurrente. Se
> documentan cuando el patrón aparece en varias pantallas o cuando el Manual de marca lo especifica
> como pieza propia.

## Diferencia entre componente y pattern

- **Componente**: una unidad reusable ([Button](../components/button.md),
  [Card](../components/card.md)).
- **Pattern**: una composición que resuelve un caso de uso
  ([Login](login.md) combina panel + firma + inputs + botón de sesión).

## Especificados

| Pattern | Composición | Origen |
|---|---|---|
| [Login](login.md) | Panel decorativo + firma con bajada + 2 inputs + botón de sesión | Manual de marca v1.0, «Aplicaciones» |

## Candidatos del manual, sin spec todavía

El manual describe estas piezas pero no con detalle suficiente para un pattern propio:

| Candidato | Qué falta |
|---|---|
| **Cabecera de aplicación** | El manual la muestra (firma + [avatar](../components/avatar.md) + nombre) pero no especifica su alto ni su comportamiento |
| **Firma en documentos** | Definida para correo y documentos (firma a 120 px + nombre en Gabarito 14/600 + cargo 13/400 `#6D727B`); es pieza de marca, no de interfaz |
| **Formulario** | [Input](../components/input.md) y [Select](../components/select.md) están especificados; falta la regla de agrupación, orden y validación — y el producto tiene **tres enfoques de formulario** conviviendo, que es una decisión de implementación pendiente |
| **Detalle de requisito** | Compone [ViewHeader](../components/view-header.md) + [Stepper](../components/stepper.md) + [Card](../components/card.md) + [Accordion](../components/accordion.md); conviene esperar a que se resuelva el conteo de etapas del stepper |
| **Listado con filtros** | [Tabs](../components/tabs.md) + [Table](../components/table.md) + [Pagination](../components/pagination.md) + [EmptyState](../components/empty-state.md) |

## Piezas de marca fuera de interfaz

El manual también fija **presentaciones** (portada azul oscuro con trama, interiores sobre niebla,
títulos en Sora 700, cuerpo en Gabarito) y **favicon / PWA** (símbolo centrado sobre azul oscuro al
62 % del lienzo, radio 22 % en el icono de app). Viven en
[logo](../foundations/logo.md), no como patterns de interfaz.

Para agregar un pattern, ejecutá `/product-design-system-update`.
