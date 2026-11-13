# Patterns del Design System

> **Carpeta vacía inicial** — Los patterns son composiciones reusables de
> componentes (forms, empty-states, navigation, feedback). Se documentan
> cuando emergen patrones repetidos en varias pantallas.
>
> Para agregar un pattern, ejecutá `/product-design-system-update`.

## Diferencia entre componente y pattern

- **Componente**: una unidad reusable (Button, Card, Modal).
- **Pattern**: una composición de componentes que resuelve un caso de uso
  recurrente (un Form combina Label + Input + Helper + Error).

## Patterns típicos

| Pattern | Composición | Cuándo |
|---------|-------------|--------|
| Form | Label + Input + Helper + Error | Captura de datos |
| Empty state | Icon + Heading + Paragraph + CTA | No hay datos |
| Loading state | Skeleton | Fetching |
| Error state | Alert + Retry CTA | Fallo de sistema |
| Navigation | Header + Nav-bar + Breadcrumbs | Estructura de navegación |
| List | List + Empty state + Loading + Filter | Listados de N items |
| Feedback | Toast + Banner + Inline message | Confirmaciones |

Cada pattern se documenta en su propio archivo cuando se decide formalizarlo.
