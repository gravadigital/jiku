# Ajustes visuales contra el handoff de identidad — y los cuatro defectos que sólo aparecieron renderizando

**Story:** — (trabajo interactivo, sin story) · **Request:** — · **Fecha:** 2026-09-04

Alineación de `web` con `design_handoff_jiku_identity`, el paquete de diseño de alta fidelidad que
describe ocho pantallas en modo claro y oscuro. **El contenido no cambia**: ningún texto, campo,
flujo ni endpoint se toca. Lo que cambia es la capa visual — geometría, color, tipografía — más
cuatro defectos funcionales que el proceso destapó.

El Design System pasa a **v4.0.0** (MAJOR). Ver la entrada en
[`docs/design-system/web/CHANGELOG.md`](../design-system/web/CHANGELOG.md) para el detalle por
token y por componente.

## Por qué esta entrada existe

Porque el método importa más que la lista de cambios, y porque **el primer intento fue insuficiente
de una forma que vale registrar**.

La primera pasada verificó los cambios compilando el SCSS y montándolo sobre HTML escrito a mano.
Eso no prueba nada: CSS Modules hashea las clases (`Card_footer__a3f9x`), así que el markup
inventado sólo coincidía por casualidad, y ni React ni Next ni los componentes reales entraban en
la prueba. Varios "arreglos" reportados como verificados no estaban aplicándose en la aplicación.

La segunda pasada usó **la aplicación real**: Chromium por CDP contra el dev server, con sesión, y
medición del DOM computado. Ahí aparecieron los defectos que siguen, ninguno visible leyendo el
código:

| Defecto | Cómo se detectó |
|---|---|
| `span { font-size: 1.25rem }` global ponía **20px en todo `<span>`** | Medir el `font-size` computado de un `Badge`: 20px donde su clase declara 11px |
| `td { max-width: 9.4rem }` recortaba **todas las pills de estado** | «Planificación» mide 151px en una celda topeada a 150px |
| El shell dejaba la sidebar en **40px** | `sidebarContainer` medía 40px con un hijo de 300px |
| El pie de la card de tarea **desbordaba** | `scrollWidth` 331 sobre `clientWidth` 253 |

Las dos primeras eran deuda **anterior** a este trabajo: reglas de elemento desnudas pisando lo que
los componentes declaran por clase, la misma clase de problema que S-060 cerró para `h1`/`h2`/`p` y
que S-059 había anotado explícitamente como «fuera de alcance».

La tercera la introdujo este trabajo: un `min-width` puesto en el hijo flex en vez del contenedor.

## El defecto de mayor impacto: contraste en modo oscuro

S-059 derivó los tintes oscuros con la fórmula del DS (tinte 12% / borde 26% del pleno sobre la
superficie oscura) pero **nunca redeclaró el TEXTO** de cada familia. Resultado: cada familia
conservaba su profundo del modo claro sobre un tinte oscuro.

Medido con la fórmula WCAG:

| Familia | Antes | Después |
|---|---|---|
| Violeta (análisis) | **1.38:1** | 7.37:1 |
| Ámbar (revisión) | **2.07:1** | 9.90:1 |
| Rojo (urgente) | **2.53:1** | 7.27:1 |
| Verde (resuelto) | **3.24:1** | 7.22:1 |
| Agua (desarrollo) | **3.24:1** | 9.69:1 |
| Grafito (neutro) | **3.98:1** | 7.86:1 |

Las seis por debajo del mínimo AA de 4.5:1. Los tríos explícitos del manual las resuelven todas.

`--text-link` tenía el mismo problema (3.79:1 sobre la superficie de card oscura) y pasa al verde
agua, que es lo que el manual pide: *«en oscuro el texto verde pasa a verde agua»*. El acento de
**relleno** sigue sin cambiar entre modos.

**El contraste ahora se mide, no se asume.** `web/src/styles/dark-mode-tints.test.ts` calcula el
ratio de las seis familias en cada corrida, en vez de confiar en los valores del manual.

## Dos decisiones que contradicen documentación previa

Las dos se tomaron con el usuario, no unilateralmente.

**1. `Table`: la cabecera clara es la de todos los listados.** El spec asignaba `dense` (cabecera
azul oscuro) a «tablas densas de seguimiento — tareas» y `light` a «listados navegables —
requisitos». El listado de tareas y el reporte de requisitos pasan a `light`, y **`dense` queda sin
consumidores**.

El motivo es que el propio criterio del spec fallaba: las filas de tareas **sí navegan** —el título
linkea al detalle—, así que por su propia regla les correspondía `light`. Y en pantalla la cabecera
azul era lo único oscuro del producto: se leía como error, no como señal de densidad.

`dense` se conserva declarado un release, según la política de versionado del DS.

**2. `ViewHeader` pierde su divisor.** El prototipo no lleva línea bajo el título de vista y el
spec tampoco la pedía: el `border-bottom` se había agregado en la implementación. Al quitarlo
apareció que ese borde estaba **tapando** que el área de contenido no tenía separación propia
(0px medidos entre título y filtros), así que la columna de contenido del shell pasó a declarar su
gap, como en el prototipo.

## Alcance desktop, ahora explícito

El shell declara `min-width: 1400px` en el contenedor del layout, con la sidebar fija en 300px: por
debajo de ese ancho la aplicación **scrollea en horizontal** en vez de reacomodarse. Es lo que fija
el handoff (*«no hay diseño responsive móvil en este alcance»*).

Reemplaza el `overflow-x: hidden` que tenía el área de contenido y que, por debajo de ~900px,
**recortaba** el contenido dejándolo inalcanzable — una limitación que `overview.md` ya registraba.

Esto **no** resuelve la pregunta de fondo (cómo se ve Jiku en un teléfono), que sigue abierta en
FG-5. Cierra el síntoma.

## Una funcionalidad recuperada

El filtro por proyecto del listado de requisitos **había perdido su buscador** en S-057, al migrar
de `react-select` al `Select` del DS: el componente propio no tenía esa capacidad. Con ~100
proyectos, encontrar uno era impracticable.

`Select` gana una prop `searchable` (opt-in) con filtrado **insensible a acentos** — `validacion`
encuentra `Validación Fiscal`, algo que `react-select` no hacía. Se activó también en el reporte de
requisitos (98 opciones) y en el selector de persona de la carga de horas. **No** en «Motivo de
ausencia»: es un conjunto corto y cerrado, donde un buscador estorba.

Un detalle que era fácil de romper: la navegación por teclado opera sobre las opciones **visibles**,
no sobre la lista completa. Con el índice apuntando a la lista sin filtrar, `Enter` elegiría una
opción distinta de la resaltada — un bug silencioso.

## Paleta anterior: dos mapas de color dados de baja

`objectiveHelpers.ts` y `projectHelpers.ts` seguían declarando `OBJECTIVE_STATE_COLORS`,
`OBJECTIVE_AREA_COLORS` y `PROJECT_STATUS_COLORS` con la paleta que la tabla de migración del
handoff descontinúa (`#22C55E`, `#EC4899`, `#8B5CF6`, `#F59E0B`…). **No tenían consumidores**: sólo
se re-exportaban desde el barrel de cada módulo.

El color de estado hoy lo resuelve la familia del `Badge` del DS. Las **etiquetas** se conservan
intactas: cambió el color, no el contenido.

`web/src/features/legacy-palette.guard.test.ts` impide que reentren.

## Lo que NO se tocó, y por qué

**La sesión no trae el nombre del usuario.** El callback `profile()` de Zitadel en
`web/src/lib/auth.ts` devuelve sólo `id` y `roles`, descartando `profile.name` y `profile.email`
aunque el scope `profile` sí se pide. Verificado contra `/api/auth/session`: las claves son
`['id','roles','zitadelId']` y `name` es `null`.

Consecuencia visible: **el avatar del sidebar sale vacío** para todo usuario real, y el reporte de
requisitos muestra IDs crudos de Zitadel en «Creado por» en vez de nombres.

Es un defecto **funcional de autenticación**, no visual, y el alcance de este trabajo era la capa
visual. Se mitigó lo visual —el bloque de identidad sólo se renderiza si hay nombre, así que el
círculo vacío desaparece— y el defecto de fondo queda registrado acá para quien lo encare.

## Notas para quien siga

- **Los guardias se actualizaron con el motivo escrito, no se relajaron.** Cuatro tests
  contradecían estos cambios (el criterio de `Table`, el borde de `ViewHeader`, `--avatar-bg`, la
  regla `span`). Cada uno se reescribió explicando por qué la decisión anterior quedó superada. Un
  quinto grupo eran defectos míos —literales sin tokenizar— y ahí el arreglo fue en el código.
- **El alto de fila de tareas es de 75px, no 48px.** Sus celdas apilan contenido (etiqueta de área
  + responsable en dos renglones); es estructura, no CSS. Queda abierto.
- **Verificar en la aplicación real, no en el CSS.** El contenedor `jiku-local-web` corre una
  **imagen construida sin montar el código**: para ver cambios hay que levantar un dev server
  aparte. Es la trampa que hizo que la primera pasada mirara una build vieja.
