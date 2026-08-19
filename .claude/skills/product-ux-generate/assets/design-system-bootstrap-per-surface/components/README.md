# Componentes del Design System

> **Carpeta vacía inicial** — Los componentes se documentan uno por uno cuando
> el equipo de diseño los define.
>
> Para agregar un componente, ejecutá `/product-design-system-update` y
> describí lo que querés crear:
>
> ```
> /product-design-system-update
> > agregá un componente Button con variants primary, secondary, disabled
> ```

## Estructura esperada

Cada componente tiene un archivo `.md` con las 12 secciones canónicas
(template en `.claude/templates/ds-component-tmpl.yaml`):

```
components/
├── button.md
├── text-input.md
├── card.md
├── modal.md
└── ...
```

## Secciones obligatorias de un component spec

1. **Propósito** — cuándo usar, cuándo NO usar
2. **Anatomía** — partes nombradas
3. **Variants** — variaciones semánticas
4. **Sizes** — tamaños disponibles
5. **States** — default/hover/focus/active/disabled/loading/error
6. **Spacing & sizing rules** — padding/margin/min/max
7. **Accesibilidad** — ARIA + keyboard + foco + screen reader
8. **Guidelines de contenido** — microcopy
9. **Do's & don'ts** — antipatterns
10. **API** — props/slots/events (framework-agnostic)
11. **Componentes y patterns relacionados**
12. **Historial** — changelog del componente

## Orden recomendado de creación

Cuando se inicia el DS desde cero:
1. **Button** — más usado, tiene todas las variantes típicas.
2. **TextInput** — base de formularios.
3. **Card** — contenedor genérico.
4. **Modal** — overlay.
5. Resto del catálogo del diccionario de wireframes (header, nav-bar, tabs, alert, etc.).
