# `identityType` en los payloads de autoría — diez `include`, una proyección a mano y `AuthorUser`

**Story:** S-019 (`api`) · **Request:** REQ-005 · **Fecha:** 2026-08-24

Los `include` de `User` que alimentan una **autoría** suman `identityType` a sus `attributes`, la
proyección a mano de `GET /api/opus/requirements/:reqid` suma el campo en sus **dos** objetos de
autor, y `docs/apis/api.yaml` gana el schema `AuthorUser` con su `enum`. **`roles` sigue sin salir
en ninguna respuesta HTTP**, y el schema `User` del spec no cambió.

Es el **habilitador** de la story: sin este campo, `web` y `opus-web` no tienen con qué decidir
cuándo renderizar la marca de identidad automática, y la única alternativa —inferirla del `name` o
del dominio del email— produce **falsos positivos sobre personas reales**.

**Ninguna migración, ningún cambio de modelo.** Las dos columnas las creó S-015; esto solo lee
`identityType`, y **no lee `roles` en absoluto**. `git diff -- packages/ api/db-upgrade/` está
vacío, y eso es parte de lo verificado.

## Los `include` que sumaron el campo — diez, no siete

| # | Archivo | Alias | Alimenta |
|---|---|---|---|
| 1 | `lib/routes/requirements-id-get.ts:14` | `creator` | `"Creado por"` de `detalle-requisito` (`web`) |
| 2 | `lib/routes/requirements-id-get.ts:24` | `changedByUser` | `feed-actividad` de `detalle-requisito` (`web`) |
| 3 | `lib/routes/projects-id-get.ts:12` | `creator` | `"Creado por"` de `detalle-proyecto` (`web`) |
| 4 | `lib/routes/objectives-id-get.ts:12` | `creator` | `"Creado por"` de `detalle-tarea` (`web`) |
| 5 | `lib/routes/objectives-id-get.ts:16` | `user` | historial **y** comentarios de `detalle-tarea` (`web`) |
| 6 | `lib/utils/middlewares/validate-requirement.ts:14` | `creator` | `pie-autoria` de `detalle-requisito` (`opus-web`) |
| 7 | `lib/routes/opus-requirements-id-get.ts:19` | `changedByUser` | feed y comentarios de `opus-web` |
| 8 | `lib/routes/opus-projects-projid-requirements-get.ts:52` | `creator` | `tablero-requisitos` (`opus-web`) |
| 9 | `lib/utils/middlewares/validate-project.ts:26` | `creator` | **nada**: ninguna ruta serializa `req.project` |
| 10 | `lib/utils/middlewares/validate-objective.ts:25` | `creator` | **nada**: el archivo no tiene importadores |

Los puntos 9 y 10 se acotaron **por consistencia**, con un comentario en el código que dice que no
llegan a ninguna respuesta, para que el próximo lector no busque el payload que producen —porque no
producen ninguno.

> **El plan decía «siete», y son diez.** El número 7 del plan es el de su Tarea 1 sola; la Tarea 2
> agrega otros tres. La verificación correcta es la que quedó abajo: **16 `include` de `User` en
> `lib/`, todos con `attributes`, 10 con `identityType` y 6 sin él.**

## La proyección a mano — la mitad que el `include` no cubre

`GET /api/opus/requirements/:reqid` es el único endpoint de la api que **no serializa el modelo**:
`sendResponse` construye la respuesta campo por campo (`opus-requirements-id-get.ts`). Agregar
`identityType` al `include` **no cambia un byte de lo que sale**, así que el campo se sumó también a
las dos proyecciones —`creator` y `requirementActivity[].user`— con un comentario que registra por
qué aparece dos veces en el archivo.

La aserción que atrapa el olvido en cualquiera de las dos mitades es el `should.eql({...})` estricto
de `tests/routes/opus-requirements-id-get.test.ts`.

## El spec: `AuthorUser`, y `User` intacto

De las dos restricciones juntas —CA-1 («los payloads de autoría suman `identityType`») y CA-2 («el
schema `User` no cambia»)— sale la única forma posible: **un schema nuevo para la autoría**.

- **`AuthorUser`** (nuevo): `id`, `name`, `email`, `identityType` con `enum: [person, service]`.
- **`User`**: sus cuatro `properties` **no cambiaron**. Su `description` sí: ahora distingue los dos
  campos —`roles` no sale **nunca**; `identityType` sale **solo** en los payloads de autoría.
- **`RequirementWithRelations.creator`** apunta a `AuthorUser`, y el schema gana una `description`
  que registra cuáles de sus **cinco** endpoints devuelven `creator` de verdad (dos) y cuáles no.
- Quedaron declarados los payloads de autoría que el código devolvía y el spec no declaraba:
  `GET /projects/{id}`, `GET /objectives/{id}` (incluida la lista `ObjectiveActivity`),
  `GET /opus/projects/{projid}/requirements` y el feed `activity` de `RequirementWithRelations`.
- `GET /opus/requirements/{reqid}` ganó una `description` que documenta su **proyección a mano**
  campo por campo, incluido que `subscriptors[]` se queda en tres campos.

## Las tres cosas que explícitamente NO cambiaron

| Superficie | Por qué queda afuera | Red que lo protege |
|---|---|---|
| **El selector de personas** (`GET /api/opus/projects/:projid/users`) | Ya filtrado a `identityType: 'person'` por S-015: toda fila que devuelve es una persona, así que el campo sería **constante**. Y es la superficie de `external-user` (ADR-006) | `S-019 TS-20` y `S-019 TS-21` en `opus-projects-projid-users-get.test.ts`, además del test de 3 claves preexistente, que **no se tocó** |
| **`listado-proyectos`** (`GET /api/projects`) | Descartada por CA-15: la pantalla no tiene dónde poner la marca. `projects-get.ts:31` mantiene tres claves, y el `$ref` de la respuesta **sigue apuntando a `User`**, no a `AuthorUser` | El test de 3 claves de `projects-get.test.ts`, que **no se tocó** |
| **`listado-requisitos`** (`GET /api/requirements`) | La tabla no tiene columna de autor, y el `include` de `creator` **no existe** en `requirements-get.ts`. No se le agregó | `S-019 TS-23` en `requirements-get.test.ts` |

Y dos objetos de usuario más se quedaron en tres claves a propósito, porque son **selectores y no
autorías**: `subscriptors[]` de `GET /api/opus/requirements/:reqid`, y el
`objectiveSubscriptors → user` de `validate-objective.ts`. El `uploader` de
`attachments-get.ts` también sigue en tres: no está en el inventario de la story.

## Verificación

```sh
# 16 include de User en lib/, todos con attributes: 10 con identityType, 6 sin él
grep -rn -A 4 "model: User" api/lib/ | grep -E "model: User|attributes"

npm run lint --workspace @jiku/api        # limpio
npm run build:packages                    # ok, y packages/ sin cambios
npm test --workspace @jiku/api            # 762 passing
```

El spec parsea y **ningún `$ref` quedó colgado**; `components.schemas.User.properties` sigue siendo
exactamente `id`, `name`, `email`, `username`.

## Lo que sigue pendiente, y dónde va

- **El `UserSummary` completo** —un schema para todo `User` embebido (`creator` de listados,
  `uploader`, suscriptores), dejando `User` para donde se devuelve el usuario completo— sigue siendo
  de `/product-change-technical-definition`. `AuthorUser` **no lo reemplaza**: cubre la autoría.
- **Ningún test compara el spec con las respuestas.** Si `AuthorUser` y un handler divergen, nada lo
  detecta. Los tests de claves exactas afirman sobre el **handler**, no sobre el spec.
- **`tests/routes/opus-projects-projid-objectives.test.ts` está mal nombrado**: testea
  `GET /opus/projects/:projid/requirements`. No se renombró para no meter ruido en el diff de una
  story de un campo. La corrección es `opus-projects-projid-requirements-get.test.ts`.
- **Dos archivos de `lib/utils/` sin importadores** —`validate-objective.ts` y
  `find-persons-by-missing-hours-interval.ts`— siguen ahí. Su limpieza es un cambio propio.
