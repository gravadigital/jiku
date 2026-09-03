---
foundation: voice-tone
version: 2.1.0
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026) — «La marca» + relevamiento de los 52 toasts de `web`
---

# Voice & Tone (web)

> **Normativo.** El manual define la **personalidad de marca** y el vocabulario; el **tono por
> contexto** se decidió el 2026-09-02 a partir de esa personalidad y del relevamiento de los 52
> toasts del producto.
>
> **La forma concreta de cada tipo de mensaje vive en
> [guidelines/content.md](../guidelines/content.md).** Este archivo define *cómo habla* Jiku; esa
> guideline, *qué forma tiene* cada mensaje.

## Propósito

Define cómo habla Jiku: personalidad, vocabulario de marca y tono. Garantiza coherencia entre el
microcopy de pantallas, errores y notificaciones.

## Personalidad

Cinco atributos, del manual:

| Atributo | Qué implica al escribir |
|---|---|
| **Preciso** | Nombrar la cosa exacta: «Pasar a revisión», no «Continuar» |
| **Sereno** | Sin urgencia artificial ni signos de exclamación |
| **Técnico** | Se asume un usuario que conoce su dominio: proyecto, requisito, etapa |
| **Legible** | Frases cortas, una idea por frase |
| **Sin adorno** | Ninguna palabra que no aporte información |

## Vocabulario de marca

| Término | Uso |
|---|---|
| **Jiku** | El producto. Del japonés *jiku* (軸), «eje» |
| **El eje es el proyecto** | Bajada oficial. Versalitas junto al logotipo; caja baja en texto corrido |
| **Grava** | La organización. Jiku firma el producto; Grava firma la organización |

## Vocabulario de dominio

Los términos que el producto usa en interfaz, tal como aparecen en el manual:

**actores · proyectos · requisitos · tareas · asignación de tiempo · horas · etapas**

Estados de requisito: **análisis · planificación · en cola · desarrollo · revisión · resuelto ·
cancelado**.

Tipos: **mejora · funcionalidad · incidencia**. Prioridades: **alta · media · baja**.

> **Se usa siempre el mismo término para la misma cosa.** El estado se escribe igual en el pill, en
> el stepper y en la tabla.

## Convenciones de escritura

Derivadas de los ejemplos del manual:

- **Español rioplatense**, voseo cuando hay imperativo: «Arrastrá archivos aquí».
- **Sentence case** en labels y botones: «Nuevo proyecto», no «Nuevo Proyecto».
- **Verbo primero** en acciones: «Guardar», «Pasar a revisión», «Cerrar sesión».
- **Versalitas** reservadas a labels de filtro y estados: «ordenar por», «en curso».
- **Sin cursiva en interfaz**, nunca (ver [typography](./typography.md)).
- **Estados vacíos en negativa neutra:** «No hay etapas activas», «No se encontraron requisitos»,
  «No hay cargas para este día».
- **Restricciones junto al control:** «Máximo 10 MB por archivo. No se permiten ejecutables ni
  scripts.»

## Tono por contexto

**Decidido el 2026-09-02.** El tono **no cambia** entre contextos: la personalidad de marca es
sereno y sin adorno, y eso vale igual para un éxito que para un error. Lo que cambia es **qué
información lleva cada mensaje**.

| Contexto | Tono | Qué lleva | Forma |
|---|---|---|---|
| **Éxito** | Sereno, confirmatorio | Qué pasó, nada más | `{entidad} {participio}`, **sin sufijo** — «Proyecto creado» |
| **Error de operación** | Sereno, accionable | Qué no se pudo **+ qué hacer** | «No se pudo crear el proyecto. Revisá los campos obligatorios.» |
| **Error de validación** | Directo | La condición a corregir | «Hay campos obligatorios sin completar» |
| **Error de permiso** | Directo, cerrado | Qué no se puede, **sin** «qué hacer» | «No tenés permisos para descargar este archivo» |
| **Confirmación destructiva** | Directo, sin dramatismo | Entidad nombrada + irreversibilidad | «Se va a eliminar el requisito #151. Esta acción no se puede deshacer.» |
| **Estado vacío** | Neutro | Qué no hay | «No hay etapas activas» |
| **Carga** | Neutro | Que está en curso | «Cargando…», texto único |

**Las tres decisiones que sostienen la tabla:**

1. **El tono es uno solo.** No hay un registro «cálido» para el onboarding ni uno «empático» para
   el error: la marca es *precisa, serena, técnica, legible, sin adorno*, y un mensaje que se sale
   de eso suena a otro producto.
2. **Nunca se culpa ni se disculpa.** Ni «Todavía no cargaste nada» ni «Lamentamos el
   inconveniente». Se informa y se sigue.
3. **El «qué hacer» va sólo donde hay algo que hacer.** Es lo que distingue las tres familias de
   error: exigirlo en un error de permiso produce relleno.

> **El detalle por tipo de mensaje, con los ejemplos del producto y el plan de migración de los 52
> toasts, está en [guidelines/content.md](../guidelines/content.md).**

## Guidelines

**Do:**

- Nombrar la acción concreta que el control ejecuta.
- Usar el término de dominio, siempre el mismo.
- Poner la restricción al lado del control que la sufre.

**Don't:**

- **NO SE DEBEN** usar signos de exclamación en interfaz.
- **NO SE DEBE** disculparse ni culpar al usuario.
- **NO SE DEBEN** usar los sufijos «con éxito», «exitosamente» ni «correctamente».
- **NO SE DEBE** usar «Click aquí» ni un label que no diga qué hace.
- **NO SE DEBEN** usar términos técnicos de implementación en la interfaz («Error 500»).
- **NO SE DEBE** cambiar el nombre de un estado entre pantallas.

## Accesibilidad

- El label de un control **DEBE** describir su acción sin depender del contexto visual.
- Los mensajes de error **DEBEN** decir qué pasó y qué hacer, no sólo que falló.
- El texto alternativo de la firma es «Jiku»; el símbolo decorativo va `aria-hidden`.

## Ejemplos

- [Button](../components/button.md) — labels verbo-primero.
- [Empty state](../components/empty-state.md) — negativa neutra.
- [Dropzone](../components/dropzone.md) — restricción junto al control.

## Historial

- 2026-09-02 v2.1.0 — **Decidido el tono por contexto:** el tono es uno solo (sereno, sin adorno) y
  lo que varía es la información de cada mensaje. Se agrega la tabla de siete contextos y las tres
  reglas que la sostienen. Deja de estar `parcial`; el detalle por tipo de mensaje va a
  `guidelines/content.md` (MINOR).
- 2026-09-02 v2.0.0 — Personalidad de marca, vocabulario y convenciones de escritura desde el
  Manual de marca Jiku v1.0. El tono por contexto queda **pendiente**: el manual no lo define.
  Reemplaza el placeholder genérico (MAJOR).
- 2026-08-18 v0.1.0 — Placeholder inicial.
