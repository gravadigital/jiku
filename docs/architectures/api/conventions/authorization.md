---
id: authorization
display_name: Autorización (rol + permiso por entidad)
language: node
description: Three authorization layers - global auth by HTTP method, role check, and per-entity project permission
applies_to: [api]
required_by: [auth-jwt]
package: null
---

# Autorización (api)

> **Convención nueva**, sin equivalente en el catálogo, que trata autenticación y autorización
> juntas dentro de `auth-jwt`. Acá se separan porque la autorización de este servicio tiene una
> tercera capa —permiso por entidad— con lógica propia de ~180 líneas.

## Cuándo aplica

Todo endpoint. La primera capa es automática; la segunda y la tercera se declaran por ruta.

## Las tres capas

```
1. Autenticación global   app.ts → validateToken           ¿hay un usuario válido?
        ▼
2. Rol                    hasAnyRole(['user','admin'])      ¿su rol alcanza para esta ruta?
        ▼
3. Entidad                validateProjectPermissions        ¿puede tocar ESTE proyecto?
                          canUserAccessEntity / canUserViewEntity
```

La capa 1 está en [`auth-jwt`](./auth-jwt.md). Acá van la 2 y la 3.

## Los roles

| Rol | Alcance |
|---|---|
| `admin` | todo, más editar la asignación semanal. **Imputar horas a terceros también es suyo, pero desde REQ-007 (S-031) no lo verifica la api**: la regla vive en `core` y llega como `access_denied` en el reply |
| `user` | equipo interno: proyectos, requisitos, tareas, sus propias horas |
| `external-user` | solo `/api/opus/*`, y solo los proyectos concedidos en `user_project_permissions` |

Salen del claim `urn:zitadel:iam:org:project:roles` y quedan en `req.decodedTokenRoles`.

## Capa 2: `hasAnyRole`

```ts
// lib/utils/middlewares/has-any-role.ts
router.get('/requirements', hasAnyRole(['user', 'admin']), getRequirements);
```

Pasa si el token tiene **al menos uno** de los roles listados. Si no, `403 access_denied`.

**Combinaciones que usa el servicio:**

| Roles | Dónde |
|---|---|
| `['user', 'admin']` | superficie interna: requisitos, horas, reportes |
| `['admin']` | `PUT /api/week-assigned-times` |
| `['admin', 'user']` | `GET /api/settings/hours-per-day`, `GET /api/week-assigned-times` |
| `['user', 'external-user']` | superficie `/api/opus/*` |
| `['external-user']` | suscripciones de opus |
| ninguno | 24 endpoints sin chequeo de rol |

> **Un endpoint sin `hasAnyRole` es alcanzable por cualquier usuario autenticado**, incluido un
> `external-user`. Algunos lo hacen a propósito porque validan por entidad en el handler (todos
> los de adjuntos). Otros simplemente no lo tienen: `GET /api/clients`, `GET /api/projects`,
> `POST /api/objectives` y los `PATCH` de clientes y proyectos.
>
> Para un endpoint nuevo, declará el rol explícitamente. La ausencia no es una convención, es
> deuda.

## Capa 3: permiso por entidad

### `validateProjectPermissions`

El middleware estándar. **Solo restringe a `external-user`**; el resto pasa de largo:

```ts
// lib/utils/middlewares/validate-project-permission.ts:5-7
if (!req.decodedTokenRoles.includes('external-user')) {
  return next();
}
// busca UserProjectPermission { userId, projectId } → 403 si no hay
```

Necesita `req.project` cargado, así que va **después** de `validateProject`,
`validateRequirement` o `validateObjective`.

```ts
router.get('/opus/requirements/:reqid',
  hasAnyRole(['user', 'external-user']),
  validateRequirement,              // carga req.requirement y req.project
  validateProjectPermissions,       // 403 si el external-user no tiene permiso
  getRequirement
);
```

### `canUserAccessEntity` / `canUserViewEntity`

Para adjuntos, donde la entidad no viene en el path sino en el cuerpo o en la fila del adjunto.
Viven en `lib/utils/attachments-access.ts` y resuelven el `projectId` desde **9 tipos de
entidad**:

| `entityType` | Cómo llega al proyecto |
|---|---|
| `project` | el `entityId` **es** el `projectId` |
| `requirement` | `Requirement.projectId` |
| `objective` | `Objective.projectId`, más creador y asignación |
| `requirement_comment` | `RequirementActivity` → `Requirement.projectId` |
| `objective_comment` | `ObjectiveActivity` → `Objective.projectId` |
| `comment` | **legado**: prueba ambas cadenas. Pendiente S-096 |
| `comment_draft` | el `entityId` puede ser requisito u objetivo; prueba las dos |
| `objective_draft`, `requirement_draft` | el `entityId` **es** el `projectId` |
| `stage` | **devuelve `false` siempre**: la tabla ya no existe, no hay proyecto que verificar |

Dos funciones porque las reglas difieren:

- **`canUserAccessEntity`** — para **adjuntar**. Sobre un objetivo aplica reglas más finas
  (`canUserAccessObjective`): `admin` siempre; un usuario interno pasa si tiene permiso en el
  proyecto, o lo creó, o está asignado; un `external-user` necesita permiso **y** además ser
  creador o estar asignado.
- **`canUserViewEntity`** — para **ver**. Un usuario interno ve adjuntos de cualquier entidad; el
  `external-user` está restringido por permiso de proyecto en todos los tipos.

Caso especial: `entityId === null` es un draft anclado al usuario. Devuelve `true`, porque la
titularidad ya se valida por `uploaded_by` al recuperar el adjunto en cada endpoint.

## Autorización dentro del handler

Cuando la regla necesita datos que ningún middleware genérico tiene, va como middleware local del
archivo. Los casos vivos:

| Regla | Dónde |
|---|---|
| Un `external-user` solo se suscribe a sí mismo | `opus-requirements-id-subscriptors-userid-delete.ts:11-16` |
| El usuario a suscribir tiene permiso en el proyecto | `opus-requirements-id-subscriptors-post.ts:27` |
| Solo el autor edita su comentario | `objectives-id-comments-cid-patch.ts:41-50` |

> **REQ-007 (S-031) — dos filas se fueron de esta tabla.** Eran *"Solo `admin` imputa horas a otra
> persona (`worked-times-post.ts:57-83`)"* y *"Solo el dueño borra su registro de horas
> (`worked-times-id-delete.ts:50-70`)"*. Las dos, más la misma titularidad en las rutas de
> ausencias, **las aplica ahora `core`**, que es el único servicio que escribe: llegan como
> `access_denied` en el reply y salen **403**, igual que antes. Con el sobre de identidad de S-029
> `core` conoce al actor y sus roles, así que una autorización que decide *"¿podés hacer esto con
> estos datos?"* ya no tiene por qué quedarse del lado del transporte.

Y el filtrado por permiso en listados, que no es un 403 sino un `where`:

```ts
// lib/routes/opus-projects-get.ts:13-30
if (!req.decodedTokenRoles.includes('external-user')) {
  return next();                                  // ve todos los activos
}
// external-user: acota la query a sus proyectos concedidos
const permissions = await UserProjectPermission.findAll({ where: { userId: req.user.id } });
req.data.query.id = { [Op.in]: permissions.map(p => p.projectId) };
```

> **Un listado no devuelve 403: devuelve menos filas.** Si agregás un endpoint de listado a la
> superficie opus, acotá la query; no confíes en que el front filtre.

## La superficie `/api/opus/*`

Es la frontera del portal de clientes. Todo endpoint ahí:

1. declara `hasAnyRole(['user', 'external-user'])` (o `['external-user']` para suscripciones),
2. carga la entidad del path,
3. aplica `validateProjectPermissions`,
4. y si es un listado, acota la query por permisos.

> `PATCH /api/opus/requirements/:reqid` declara `hasAnyRole(['user', 'admin'])` — **sin**
> `external-user`, a diferencia del resto de la superficie. Si es intencional o un descuido está
> sin confirmar; anotalo antes de tocarlo.

## Reglas

- Declará el rol explícitamente en todo endpoint nuevo con `hasAnyRole([...])`. La ausencia no es
  una convención.
- `validateProjectPermissions` va **después** del middleware que carga `req.project`.
- Todo endpoint de `/api/opus/*` lleva las tres capas. Sin excepción.
- Un listado en la superficie opus **acota la query**, no responde 403.
- Los roles se leen de `req.decodedTokenRoles`; el usuario, de `req.user`. Nunca del cuerpo.
- Un `entityType` nuevo de adjuntos se agrega a **las dos** funciones de `attachments-access.ts`,
  y devolvé `false` cuando no haya proyecto contra el que verificar.
- 403 es `access_denied`. 401 es autenticación. No los mezcles.
- Una regla de autorización que necesita el rol, el creador o la asignación va como middleware
  local del archivo de ruta, antes del handler.
- Todo endpoint con reglas de permiso lleva su test de permisos. El modelo es
  `tests/routes/attachments-post-permissions.test.ts`.

## Integración con otras convenciones

- **auth-jwt**: provee `req.user` y `req.decodedTokenRoles`. Es la capa 1.
- **http-server**: define el orden de la cadena donde encajan estas capas.
- **orm**: `user_project_permissions` es la tabla que sostiene la capa 3.
- **error-handling**: el 403 `access_denied`.
- **storage**: los adjuntos son el caso que motiva `canUserAccessEntity` / `canUserViewEntity`.
