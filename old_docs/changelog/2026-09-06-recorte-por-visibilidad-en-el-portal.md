# El portal mostraba requisitos internos — el recorte por visibilidad de `/api/opus/*`

**Story:** — (trabajo interactivo, sin story) · **Request:** — · **Fecha:** 2026-09-06

La superficie del portal de clientes servía requisitos con `visibilityLevel: 'internal'`: los
listaba, los abría en detalle, los dejaba editar y comentar. Esta entrada registra el arreglo y
—sobre todo— **por qué el recorte no mira el rol**, que es la parte que se puede volver a romper
con buena intención.

## El síntoma y el diagnóstico

Lo reportado: *"en la web de opus se están mostrando requisitos internos"*.

La superficie ya recortaba **la actividad** de un requisito. `loadPublicActivity`
(`opus-requirements-id-get.ts`) filtra por `visibilityLevel: Public` desde S-019, con tests de
no-regresión (TS-19, y TS-27 de S-046). Lo que nunca recortó es **el requisito mismo**:

| Camino | Qué hacía |
|---|---|
| `GET /opus/projects/:projid/requirements` | `where: { projectId }` — sin `visibilityLevel` |
| `GET /opus/requirements/:reqid` | filtraba la actividad, pero servía el requisito interno entero |
| `PATCH /opus/requirements/:reqid` | dejaba editar un requisito interno desde el portal |
| `POST /opus/requirements/:reqid/comments` | dejaba comentarlo |
| `POST /opus/requirements/:reqid/subscriptors` | dejaba suscribir gente a él |

**Era un error, no una decisión**, y hay tres razones para afirmarlo:

1. **La intención estaba escrita, y es la contraria.** S-023 y S-025 definen el recorte externo del
   motor de consultas como *"proyectos permitidos **y** `visibilityLevel = public`"*. El outcome de
   S-023 dice que el bus le da al portal *"un **segundo** punto de aplicación, además de
   `validateProjectPermissions` en la api"* — asumía que la api ya aplicaba el primero.
2. **La asimetría no estaba comentada.** El servicio comenta el porqué de decisiones mucho menores
   (convención `_base`). Filtrar la actividad y no el requisito no dejó rastro en ningún lado.
3. **No había test que fijara el comportamiento.** El listado del portal directamente **no tenía
   archivo de test**, contra la regla de la convención `testing`.

## La decisión: el recorte es de la superficie, no del caller

Es lo único de esta entrada que hay que retener.

Las tres capas de autorización de la api responden **"¿quién sos?"**, y la tercera
(`validateProjectPermissions`) explícitamente **solo restringe a `external-user`**. Era tentador
copiar esa forma y filtrar la visibilidad solo para externos. **Se decidió que no**, por dos
razones:

- **La visibilidad es una propiedad del recurso, no del caller.** La pregunta que responde no es
  "¿quién sos?" sino **"¿este recurso se muestra en el portal?"**. El portal es la pantalla que se
  comparte con el cliente: un requisito interno no debería aparecer ahí aunque quien mire sea del
  equipo — basta que esté compartiendo pantalla.
- **Es lo que ya hacía el filtro de actividad.** `loadPublicActivity` nunca miró el rol. Filtrar el
  requisito por rol y la actividad sin rol habría dejado la superficie con dos criterios distintos
  para la misma palabra.

> **No contradice a S-023 CA-15** (*"el modo interno no recorta filas, y es una decisión explícita
> de la v1"*). Eso es sobre **el bus**, donde un `user` que publica directo sí ve todo. Acá el eje
> es la superficie HTTP, que es otra cosa.

### El código es 404, no 403

`requirement_not_found`, **idéntico** al de un id inexistente — mismo `code` y mismo `message`, con
un test que compara las dos respuestas con `eql`. Es el criterio de S-023 CA-14: distinguir "no
existe" de "no lo podés ver" le confirma al usuario externo que el recurso existe.

## Qué cambió

**Nuevo:** `lib/utils/middlewares/validate-requirement-is-public.ts`. Va después de
`validateRequirement`, que es quien deja `req.requirement`.

| Ruta | Cambio |
|---|---|
| `opus-projects-projid-requirements-get.ts` | `visibilityLevel: Public` en el `where`. No sale del query: no se puede desactivar por parámetro |
| `opus-requirements-id-get.ts` | `validateRequirementIsPublic` tras `validateProjectPermissions` |
| `opus-requirements-id-patch.ts` | idem, **antes** del cuerpo y del bus |
| `opus-requirements-id-comments-post.ts` | idem, antes del bus |
| `opus-requirements-id-subscriptors-post.ts` | idem |

En el `PATCH` y en los dos `POST` el corte va **antes de publicar el comando**, y hay tests que lo
verifican contra el `FakeBus`: lo que el portal no muestra, tampoco lo escribe, ni siquiera para
que `core` lo rechace del otro lado.

### La excepción declarada

`DELETE /opus/requirements/:reqid/subscriptors/:userId` **no lleva el guard**, deliberadamente:
solo borra la suscripción del propio caller (`validateSelfUnsubscribe`), así que no revela nada del
requisito, y bloquearlo dejaría **atrapado** a quien se suscribió cuando el requisito era público y
después pasó a interno — seguiría suscripto sin poder darse de baja. Está comentado en el archivo.

## Tests

Nuevo `tests/routes/opus-requirement-visibility.test.ts`, 7 casos. Las cuatro rutas se prueban con
`token_01_user` —un usuario **interno**— a propósito: es el caso que estaba roto y el que un
refactor futuro puede volver a romper si alguien mete el filtro dentro de un `if` por rol.

Suite completa de `api`: **1018 passing**, sin regresiones.

## Impacto en instalaciones existentes

**Requisitos que hoy se ven en el portal pueden dejar de verse.** El campo tiene
`defaultValue: 'public'`, así que solo afecta a los marcados `internal` explícitamente. Conviene
medirlo antes de desplegar:

```sql
SELECT count(*) FROM requirements WHERE visibility_level = 'internal';
```

Si el número es alto y esos requisitos venían apareciendo en el portal, vale avisar: para un
cliente que ya los estaba viendo, desaparecen sin explicación. **Un cliente que tenga abierta la
URL directa de uno de ellos va a recibir un 404**, no un mensaje.

## Lo que esta entrada NO resuelve

- **La pregunta abierta 2 de `opus-web`** (*"¿un usuario interno debería poder operar desde el
  portal?"*) sigue abierta. Se achicó: un rol interno ya no ve **más requisitos** que el cliente,
  pero sigue pudiendo cambiar estado y prioridad sobre los públicos que sí ve.
- **`PATCH /opus/requirements/:reqid` sigue declarando `hasAnyRole(['user','admin'])` sin
  `external-user`**, a diferencia del resto de la superficie. Sigue sin confirmarse si es
  intencional; no se tocó acá.
- **La visibilidad de otras entidades del portal** (adjuntos, proyectos) no se revisó en este
  trabajo.
