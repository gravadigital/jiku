# ADR-010: Sass + CSS Modules + custom properties, sin librería de componentes

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** frontend, estilos, design-system
**Detectado desde:** `web`, `opus-web`

---

## Contexto

Los dos frontends necesitaban una estrategia de estilos. Las opciones habituales eran una librería
de componentes (MUI, Chakra, Ant), un framework utilitario (Tailwind), CSS-in-JS, o CSS Modules
con un preprocesador.

El producto es una herramienta interna con una identidad visual propia y patrones de interfaz
específicos —tablas densas, grillas de asignación, tableros kanban, feeds de actividad— que no
mapean directamente a los componentes de ninguna librería.

## Decisión

**Sass + CSS Modules + custom properties de CSS, sin librería de componentes.**

- **CSS Modules** (`*.module.scss`) para el scope: 117 módulos en `web`, 33 en `opus-web`.
- **Custom properties** en `:root` como capa de tokens: `_variables.scss` declara ~70 en `web`.
- **Mixins de Sass** (`_mixins.scss`) para encapsular tipografía, botones, inputs, tags y focus
  rings — la unidad de reutilización visual, en lugar de componentes de librería.
- **Componentes propios** en `shared/components/ui/`: 33 en `web`, 12 en `opus-web`.

`opus-web` agrega un patrón propio: **variantes con atributos `data-*`**
(`<button data-variant="primary" data-size="md">` con `&[data-variant='primary']` en el SCSS) en
lugar de mapear valores a nombres de clase en JS. Es consistente en todo su `shared/ui/` y tiene
la ventaja de que la variante queda visible en el DOM al depurar.

## Implementation Rules

- Los estilos de un componente **DEBEN** vivir en su `*.module.scss` adyacente. **NO SE DEBE**
  usar CSS global salvo en `globals.scss` y en la capa de tokens.
- Los valores de color, espaciado y tipografía **DEBEN** referenciar custom properties de
  `_variables.scss`. **NO SE DEBEN** hardcodear valores hexadecimales ni píxeles sueltos.
- Los patrones visuales repetidos (tipografía, botones, inputs, tags, focus rings) **DEBEN** usar
  los mixins de `_mixins.scss`.
- Los breakpoints **DEBEN** declararse con los mixins de `_mixins.scss`. **NO SE DEBEN** escribir
  `@media` crudas con valores literales — hoy hay 14 en `web` con 8 valores distintos, y es deuda
  reconocida (NFR-U03).
- **NO SE DEBE** agregar una librería de componentes ni un framework CSS utilitario sin un ADR que
  lo reemplace.
- En `opus-web`, las variantes de componente **DEBEN** expresarse con atributos `data-*`, no con
  nombres de clase compuestos.
- Un valor de token **DEBE** declararse en un solo lugar. Hoy `globals.scss` y `_variables.scss`
  declaran el mismo `:root` con los mismos valores: es duplicación a resolver, no un patrón.

## Consecuencias

### Positivas

- **Control total sobre la identidad visual**, sin pelear con los defaults ni con la especificidad
  de una librería.
- **Sin peso de librería en el bundle** ni dependencia que actualizar con breaking changes.
- **Los tokens en custom properties** son la base natural del Design System, y permitieron sembrar
  `docs/design-system/` con los valores reales del código en vez de inventarlos.
- **CSS Modules elimina las colisiones de nombres** sin convenciones tipo BEM.
- **Los tests pueden asertar sobre clases**: `opus-web` configura
  `generateScopedName: '[local]'` en test para que las clases no se hasheen.

### Negativas

- **Todo componente se construye desde cero**, incluidos los que una librería daría resueltos:
  modales, dropdowns, selects, tooltips.
- **Sin accesibilidad de fábrica.** Una librería madura trae foco atrapado en modales, roles ARIA y
  navegación por teclado. Acá hay que implementarlos, y **hoy no están**: ningún modal atrapa el
  foco, hay elementos clickeables que no son botones, y `ListView` es una tabla hecha con `div` +
  grid sin roles de tabla (NFR-U05).
- **Reimplementación entre los dos frontends.** Cada uno tiene su propio `Button`, su propio
  `Modal`, sus propias paletas de estado — que en `opus-web` están declaradas en 5 módulos SCSS
  más un archivo de constantes.
- **Convivencia de enfoques dentro de `web`**: componentes propios (`InputSelect`) y `react-select`
  directo, con su objeto `selectStyles` **duplicado en 5 archivos**.

### Riesgos

- **Riesgo:** la accesibilidad no mejora porque no hay una librería que la traiga gratis y siempre
  hay algo más urgente.
  - **Mitigación:** los gaps están inventariados con evidencia en `docs/ux/gaps-as-is.md` y el
    trabajo está agrupado en el feature group **FG-5**.
- **Riesgo:** los tokens del código y los del Design System divergen, y el DS pasa a describir algo
  que no existe.
  - **Mitigación:** el DS se sembró **desde el código**, así que hoy coinciden. Mantenerlos
    alineados es responsabilidad de `/product-design-system-update`.
- **Riesgo:** la duplicación de tokens entre `globals.scss` y `_variables.scss` hace que un cambio
  se aplique en un lugar y no en el otro.
  - **Mitigación:** la regla de arriba. Es deuda registrada.

## Alternativas Consideradas

### Alternativa 1: Librería de componentes (MUI, Chakra, Ant Design)

**Pros:**
- Componentes accesibles y probados desde el día uno
- Mucho menos código propio que mantener
- Modales, dropdowns y selects resueltos

**Cons:**
- Identidad visual condicionada por el sistema de la librería; personalizar a fondo suele ser más
  trabajo que construir
- Peso significativo en el bundle
- Los patrones densos del producto (grilla de asignación, tabla jerárquica de 4 niveles) no mapean
  a los componentes de ninguna

**Por qué se descartó:** el producto tiene identidad y patrones propios. **Con la contrapartida
que hoy se paga en accesibilidad**, que es el costo real de este descarte.

---

### Alternativa 2: Tailwind CSS

**Pros:**
- Velocidad de desarrollo alta, sin cambiar de archivo
- Sistema de diseño implícito en la escala de utilidades
- Bundle pequeño con purga

**Cons:**
- Tampoco trae componentes: la accesibilidad seguiría siendo propia
- El markup se vuelve denso, especialmente en tablas y grillas
- Migrar 150 módulos SCSS existentes

**Por qué se descartó:** no hay evidencia de que se haya evaluado explícitamente. Resolvería la
duplicación de tokens pero no el problema principal, que es la falta de componentes accesibles.

---

### Alternativa 3: CSS-in-JS (styled-components, emotion)

**Pros:**
- Estilos y componente en el mismo archivo, con tipos
- Variantes por props de forma natural

**Cons:**
- Costo en runtime y fricción conocida con React Server Components del App Router
- Requiere configuración específica para SSR

**Por qué se descartó:** el App Router y los Server Components fueron una decisión previa
([ADR-009](ADR-009-token-confinado-al-servidor.md)), y CSS-in-JS es la peor opción de las cuatro en
ese contexto.

## Referencias

- Tokens: `web/src/styles/_variables.scss`, `opus-web/src/styles/_variables.scss`
- Mixins: `_mixins.scss` de cada frontend
- Design System sembrado: [`docs/design-system/`](../design-system/)
- Gaps de accesibilidad: [`docs/ux/gaps-as-is.md`](../ux/gaps-as-is.md)
- Feature group relacionado: **FG-5** en [`docs/prd/feature-groups.md`](../prd/feature-groups.md)
- ADRs relacionados: [ADR-009](ADR-009-token-confinado-al-servidor.md)
