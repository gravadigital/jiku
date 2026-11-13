---
guideline: content
version: 2.0.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 («La marca», ejemplos de microcopy) + relevamiento de los 52 toasts de `web`
---

# Content (web)

> **Normativo.** Fija la **forma** de cada tipo de mensaje. La personalidad y el vocabulario están
> en [voice-tone](../foundations/voice-tone.md); acá está la fórmula concreta por contexto.
>
> **La forma no se elige por pantalla.** Es la misma decisión que se tomó con «Cargando…» en
> [Loader](../components/loader.md): cuando cada consumidor redacta su propio mensaje, el resultado
> es inconsistencia por construcción.

## El problema que esta guideline resuelve

Relevamiento de los **52 toasts** de `web` (2026-09-02):

| Hallazgo | Detalle |
|---|---|
| **Tres sufijos para decir lo mismo** | «con éxito» (6) · «exitosamente» (4) · «correctamente» (3) |
| **Dos prefijos para lo mismo** | «Error al…» (6) · «Hubo un error al…» (4) |
| **Duplicados literales** | «Comentario agregado» y «Comentario agregado exitosamente» conviven |
| **Ningún error dice qué hacer** | Los 33 informan que falló y dejan al usuario sin siguiente paso |

## Regla general

De la personalidad de marca —**preciso, sereno, técnico, legible, sin adorno**:

- **Español rioplatense, voseo** en imperativos: «Revisá», «Arrastrá», «Intentá».
- **Sentence case** siempre. Nunca Title Case.
- **Sin signos de exclamación.** Ninguno, en ningún mensaje de interfaz.
- **Sin cursiva.** Versalitas sólo en labels de filtro y estados.
- **El término de dominio, siempre el mismo**: un estado se escribe igual en el pill, el stepper,
  la tabla y el toast.
- **Ninguna palabra que no aporte información.**

## Éxito

**Fórmula: `{entidad} {participio}`. Sin sufijo.**

El sufijo no agrega información: si el toast es de éxito, ya se sabe que salió bien.

| ✓ | ✗ |
|---|---|
| «Proyecto creado» | «Proyecto creado con éxito» |
| «Requisito actualizado» | «Requisito actualizado correctamente» |
| «Horas cargadas» | «Horas cargadas exitosamente» |
| «Comentario agregado» | «Comentario agregado exitosamente» |

**Los tres sufijos —«con éxito», «exitosamente», «correctamente»— quedan prohibidos.**

**Cuando el cambio tiene un valor visible, se lo nombra:**

- ✓ «Estado de la tarea cambiado a Desarrollo»
- ✗ «Se cambió el estado de la tarea a Desarrollo» — voz pasiva refleja, más larga y sin agregar nada

**Sin toast cuando el resultado ya está en pantalla.** Si el usuario ve el badge cambiar, un toast
que se lo repita es ruido. El toast es para lo que **no** se ve.

## Error

**Tres familias, y cada una tiene su fórmula.** Tratarlas igual produce relleno en una y huecos en
otra.

### 1. Fallo de operación — `{qué no se pudo} + {qué hacer}`

La acción falló por algo que el usuario puede resolver o reintentar. **La segunda frase es
obligatoria.**

| ✓ | ✗ |
|---|---|
| «No se pudo crear el proyecto. Revisá los campos obligatorios.» | «Hubo un error al crear el proyecto» |
| «No se pudo cambiar el estado. Intentá de nuevo.» | «Hubo un error al cambiar el estado» |
| «No se pudieron cargar las asignaciones. Actualizá la página.» | «Error al cargar las asignaciones de tiempo» |

**«No se pudo…» reemplaza a «Error al…» y a «Hubo un error al…».** Dice lo mismo en menos palabras
y sin nombrar la categoría técnica.

### 2. Validación — `{qué falta o qué está mal}`

Ya es accionable por sí misma: nombra la condición que hay que corregir. **No se le agrega un «qué
hacer»**, sería redundante.

| ✓ | Por qué está bien |
|---|---|
| «Hay campos obligatorios sin completar» | Dice exactamente qué corregir |
| «El comentario no puede estar vacío» | La condición **es** la instrucción |

> Estos dos mensajes del producto **ya cumplen** y no hay que tocarlos.

**Preferir el error junto al campo** antes que el toast: un `error` en
[Input](../components/input.md) llega con `aria-describedby` y señala **dónde**. El toast es para
validaciones que no pertenecen a un campo concreto.

### 3. Permiso — `{qué no se puede}`

**No lleva «qué hacer»: no hay nada que el usuario pueda hacer.** Agregar «Contactá a un
administrador» es relleno salvo que sea literalmente el procedimiento.

| ✓ | Por qué |
|---|---|
| «No tenés permisos para descargar este archivo» | Cierra el tema sin sugerir un imposible |

> Este mensaje del producto **ya cumple**.

### Reglas comunes a los tres

- **Nunca culpar al usuario, y nunca disculparse.** El tono es sereno: se informa y se sigue.
- **Nunca exponer la categoría técnica**: ni «Error 500», ni «invalid format», ni el nombre del
  endpoint.
- **Nunca «Algo salió mal»** sin decir qué: no distingue un fallo de red de un dato inválido.
- **Dos frases como máximo.** Si hace falta más, el lugar no es un toast.

## Confirmación destructiva

**No es un toast: es un [ConfirmDialog](../components/confirm-dialog.md), y su texto es el
mecanismo de seguridad.** Como ambas acciones van al mismo peso visual, **si el texto no advierte,
nada advierte**.

- **Título:** el verbo de la acción — «Eliminar requisito».
- **Cuerpo:** la entidad **nombrada** + la irreversibilidad — «Se va a eliminar el requisito #151.
  Esta acción no se puede deshacer.»
- **Botón:** el verbo, no «Sí» — «Eliminar».

| ✗ | Por qué falla |
|---|---|
| «¿Estás seguro?» | No dice qué se borra; con botones al mismo peso, deja el diálogo sin advertencia |
| «Sí / No» | Obliga a releer el título para saber qué se confirma |

## Estados vacíos

**Negativa neutra, en presente. Sin ilustración** (ver
[EmptyState](../components/empty-state.md)).

- ✓ «No hay etapas activas» · «No se encontraron requisitos» · «No hay cargas para este día»
- ✗ «¡Ups! No encontramos nada» — exclamación y tono jocoso
- ✗ «Todavía no cargaste nada» — culpa al usuario
- ✗ «Sin resultados 🔍» — sin emoji

**La acción de alta se ofrece sólo cuando el vacío es real, no filtrado.** Ofrecer «Nuevo
requisito» a quien acaba de filtrar responde una pregunta que no hizo.

## Carga

**Un solo texto: «Cargando…»**, con puntos suspensivos tipográficos (`…`). Es el default del
componente; para escribir otra cosa hay que decidirlo explícitamente.

| Duración | Tratamiento |
|---|---|
| ≤ 300 ms | Sin indicador — el usuario no lo percibe |
| > 300 ms | [Loader](../components/loader.md): `block` si ocupa el contenido, `inline` si lo acompaña |

**Excepción única:** una operación larga y nombrable puede decir qué hace — «Subiendo archivo…».
No es licencia para un texto por pantalla.

## Labels y CTAs

- **Botones:** verbo primero, 1–3 palabras, máximo 5 — «Guardar», «Pasar a revisión».
- **Labels de campo:** sustantivo — «Nombre del proyecto», «Fecha de cierre estimada».
- **Obligatoriedad:** «(obligatorio)» explícito junto al label, además del asterisco.
- **Placeholder:** ejemplo o formato, **nunca** repetición del label — «mm/dd/aaaa».
- **Restricciones junto al control**, no en tooltip — «Máximo 10 MB por archivo.»
- ✗ «Click aquí» · ✗ «Submit» · ✗ «Enviar formulario»

## Datos y fechas

- **Fechas relativas con referencia:** «Hasta 25 ago · falta 1 día», «vencido hace 1 día».
- **Celda sin dato:** «N/D» o «0 h» — nunca vacía.
- **Campo sin valor:** «Sin tipo», «Sin prioridad» — explícito, en tinte grafito.
- **Abreviaturas** sólo en cabecera de tabla densa: «Prior.», «Modif.».

## Migración

**52 toasts a revisar** en `web`:

| Grupo | Cantidad | Acción |
|---|---|---|
| Éxitos con sufijo | 13 | **Borrar** el sufijo. No hay que reescribir el mensaje |
| Éxitos ya correctos | 6 | Sin cambios |
| Errores «Error al…» / «Hubo un error al…» | 10 | Reescribir a «No se pudo… + qué hacer» |
| Errores de validación y permiso | 3 | **Sin cambios** — ya cumplen |
| Duplicados | 2 pares | Unificar («Comentario agregado») |

> El grupo de 13 es mecánico: **es borrar palabras**, no redactar. El de 10 sí requiere decidir el
> «qué hacer» de cada caso, y ahí está el trabajo real.

## Historial

- 2026-09-02 v2.0.0 — Normativo. Se fija una forma por contexto: éxito sin sufijo, error en tres
  familias (fallo de operación con «qué hacer» obligatorio, validación y permiso sin él),
  confirmación destructiva como mecanismo de seguridad, y «Cargando…» único. Se corrige el
  placeholder donde contradecía la marca: el tono deja de ser «empático» para ser **sereno**, y los
  estados vacíos van **sin ilustración**. Basado en el relevamiento de los 52 toasts (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
