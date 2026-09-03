# Design System — `web`

> **Normativo desde v2.0.0.** Este Design System describe lo que la superficie `web` **debe** ser,
> según el **Manual de marca Jiku v1.0** (septiembre 2026). **No describe el código actual:** la
> web todavía sirve la paleta rosa y la tipografía Archivo.
>
> Cada documento lleva una sección **Migración** con la conversión desde el estado actual, y
> [`foundations/color.md`](foundations/color.md#mapeo-del-sistema-anterior) tiene la tabla de mapeo
> viejo → nuevo.

## Estado actual

- **Surface:** `web`
- **Versión:** `2.4.0`
- **Estado:** normativo — pendiente de implementación
- **Origen:** **Manual de marca Jiku v1.0** (septiembre 2026) — documento de diseño, fuera del
  repositorio

## La marca en una pantalla

| | |
|---|---|
| **Primario** | Verde agua **`#61CCB9`** — acento, **nunca fondo de página** |
| **Texto y jerarquía** | Azul oscuro **`#0B1934`** |
| **Fondo de aplicación** | Niebla **`#F6F6F9`** |
| **Estructura** | Grafito **`#626C78`** |
| **Tipografía** | **Sora** (logotipo y títulos de vista) + **Gabarito** (interfaz, datos, microcopy) |
| **Radios** | 8 / 10 / 14 / 999 px, sin intermedios |
| **Foco** | Anillo verde agua de 3 px al 22 % |
| **Proporción de uso** | 60 % niebla · 24 % azul oscuro · 10 % grafito · 6 % verde agua |

**Los cuatro principios de aplicación:**

1. El verde agua es acento, nunca fondo de página.
2. El azul oscuro carga el texto y la jerarquía.
3. Los colores de sistema informan estado; no son marca.
4. Una sola familia de radios y una sola sombra por nivel.

## Estructura

```
docs/design-system/web/
├── README.md              ← este archivo
├── CHANGELOG.md           ← historial + versionado semver (independiente por surface)
├── governance.md          ← cómo proponer cambios
├── foundations/           ← primitivas visuales (9)
│   ├── logo.md            ← NUEVO: firma, resguardo, símbolo, usos incorrectos
│   ├── color.md           ← paleta + modo oscuro + sistema + mapeo del anterior
│   ├── typography.md      ← Sora + Gabarito, escala de 7 estilos
│   ├── spacing.md         ← radios, alturas, layout, sombras, z-index
│   ├── grid.md            ← breakpoints (mixto: layout normativo, responsive relevado)
│   ├── iconography.md     ← trazo 1,6 px, set de navegación, tamaños
│   ├── motion.md          ← 150 / 200 / 300 ms
│   ├── elevation.md       ← 2 sombras + anillo de foco
│   └── voice-tone.md      ← personalidad y vocabulario (parcial)
├── tokens/                ← jerarquía de 3 tiers
│   ├── reference.md       ← primitivos: color.aqua, radius.8
│   ├── semantic.md        ← alias: bg.action.primary, text.on-action
│   └── component.md       ← por componente: button.primary.bg
├── components/            ← 20 specs + 1 deprecado
├── patterns/              ← login
└── guidelines/            ← accessibility, i18n, content
```

## Decisiones tomadas

Todas las preguntas de diseño que la aplicación del manual dejó abiertas están **cerradas**. Cada
una está registrada en su spec y en el [CHANGELOG](CHANGELOG.md).

| Decisión | Versión | Resolución |
|---|---|---|
| **Etapas del stepper** | `2.1.0` | **Cinco** pasos de trabajo. El stepper **informa**; el [badge editable](components/badge.md) de la cabecera es el control de estado y ofrece los **siete**. Coincide con lo que el código ya hace |
| **Acción destructiva** | `2.1.0` | **Secundario de borde claro** en ambas acciones, sin rojo y sin primario. La advertencia la carga el **texto**, que pasa a ser parte del mecanismo de seguridad |
| **Alcance del manual** | `2.2.0` | **No aplica a `opus-web`.** Dos marcas: Jiku interno, **Opus** de cara al cliente, con DS independientes. Ver [ADR-006](../../adrs/ADR-006-dos-frontends-una-api.md#identidad-visual-dos-marcas-separadas) |
| **Tono por contexto** | `2.3.0` | El tono es **uno solo** (sereno, sin adorno); lo que varía es la información de cada mensaje. Forma fija por contexto en [guidelines/content.md](guidelines/content.md) |
| **Responsive** | `2.4.0` | Mobile es **objetivo declarado sin fecha**. `mobile` no se declara como viewport hasta que el shell lo cumpla; el primer trabajo es el **shell** |

### Lo que queda: trabajo, no preguntas

| Pendiente | Volumen | Nota |
|---|---|---|
| **Migrar el microcopy** | **52 toasts** | 13 son *borrar el sufijo* (mecánico); 10 requieren decidir el «qué hacer» de cada error. 3 ya cumplen |
| **Migrar a la paleta y tipografía nuevas** | todo `web` | Cada spec tiene su sección **Migración**; la tabla de conversión está en [color.md](foundations/color.md#mapeo-del-sistema-anterior) |
| **Clasificar los `secondary` de Button** | **29 usos** | No es automático: un `#D9D9D9` puede ser «Volver» o «Cancelar», y el sistema nuevo los distingue |
| **Sacar el código muerto del barrel** | 7 componentes | `Card`, `Input` y `Textarea` **colisionan** con specs nuevos: hay que sacarlos antes de crear los componentes, o el import resuelve al muerto |
| **Shell responsive** | FG-5 | Cuando se encare, **hay que decidir cómo se ve Jiku en un teléfono**: el manual no lo dice |
| `guidelines/accessibility.md` y `i18n.md` | 2 archivos | Siguen en placeholder. Las reglas de accesibilidad **por componente** ya están en cada spec |

## Flujo de trabajo

1. **Foundations** definidas — base del sistema.
2. **Tokens** semánticos y de componente derivados de foundations.
3. **Components** documentados — 20 specs.
4. **Iterar** — `/product-design-system-update` cuantas veces haga falta.

## Versionado (semver, independiente de otros surfaces)

- **MAJOR** (X.0.0): breaking change. Renombrar componente, remover variant, cambiar API, remapear
  un token semántico. Requiere revisar los wireframes que pinneen versiones anteriores.
- **MINOR** (0.X.0): agregar componente, variant, foundation o token.
- **PATCH** (0.0.X): corrección, ajuste de spec, microcopy en guidelines.

Los cambios deprecados se marcan `deprecated: true` con migration path antes de removerse en el
siguiente MAJOR — ver [input-select.md](components/input-select.md) como ejemplo vigente.

Otros surfaces pueden tener versiones distintas: **cada surface es soberano de su propio DS.**
`opus-web` sigue en `0.1.0` y no se vio afectado por esta versión.
