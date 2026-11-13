# ADR-006: Dos frontends separados sobre una misma API

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** arquitectura, frontend, seguridad, aislamiento, multi-tenant
**Detectado desde:** `web`, `opus-web`, `api`

---

## Contexto

El producto tiene dos audiencias con una asimetría fuerte de confianza:

- El **equipo interno** necesita ver todo: horas, costos en tiempo, comentarios internos,
  proyectos de todos los clientes, planificación de capacidad.
- El **cliente externo** debe ver **solo** sus propios proyectos, y de ellos solo la actividad
  pública. Nunca horas, nunca comentarios internos, nunca la existencia de otros clientes.

La forma más común de resolver esto es una sola aplicación que oculta secciones según el rol.
Funciona, y tiene un problema conocido: **la separación queda a nivel de renderizado**. Un bug de
condicional, una ruta olvidada o un componente que se monta antes de verificar el rol filtran
información. Y el modo de fallo es silencioso: nadie se entera hasta que un cliente ve algo que no
debía.

Agravante en este producto: el dato más sensible no son los proyectos ajenos sino **las horas**.
Un cliente que ve cuántas horas se imputaron a su proyecto conoce el costo interno del trabajo.

## Decisión

**Dos aplicaciones frontend separadas** sobre una única API, con la superficie de cliente separada
también a nivel de ruteo y de autorización:

| | `web` | `opus-web` (Opus) |
|---|---|---|
| Audiencia | Equipo interno (`admin`, `user`) | Cliente externo (`external-user`) |
| Superficie de API | 49 endpoints internos | **12 endpoints bajo `/api/opus/*`** |
| Despliegue | Dominio propio (`${DOMAIN}`) | Dominio propio (`${OPUS_DOMAIN}`) |
| Alcance | 25 rutas, 8 dominios | 5 páginas, 6 dominios |

El aislamiento se apoya en **tres capas independientes**, ninguna de las cuales es la UI:

1. **Ruteo:** los endpoints del cliente viven bajo `/api/opus/*`, separados de los internos. No es
   el mismo endpoint con un filtro: son handlers distintos.
2. **Rol:** `hasAnyRole(['external-user'])` en las rutas del portal.
3. **Entidad:** `validateProjectPermissions` restringe a los proyectos con fila en
   `user_project_permissions`. Para adjuntos, `canUserAccessEntity`/`canUserViewEntity` resuelven
   el proyecto desde **9 tipos de entidad distintos** antes de decidir.

A eso se suma el modelo de **visibilidad `public`/`internal`** por actividad: el feed del portal
solo muestra las públicas, y la regla de qué es público **la decide el sistema, no el usuario**
(estado, título y descripción son públicos; el resto interno; solo los comentarios permiten
elegir).

**Los dos frontends comparten la app OIDC de Zitadel** (mismo `ZITADEL_CLIENT_ID`) con secretos de
sesión distintos.

### Identidad visual: dos marcas separadas

**Decidido el 2026-09-02.** La separación no es sólo técnica: **`web` es Jiku y `opus-web` es
Opus**, y son dos marcas distintas con Design Systems independientes.

| | `web` → **Jiku** | `opus-web` → **Opus** |
|---|---|---|
| Fuente de identidad | **Manual de marca Jiku v1.0** (sept. 2026) | Ninguna todavía — DS relevado del código |
| Accent | `#61CCB9` verde agua | `#2563eb` azul |
| Tipografía | Sora + Gabarito | Stack de fuentes de sistema |
| Cómo se presenta | Firma Jiku en sidebar y login | «¡Bienvenido a OPUS!», `logo.png` propio, `title: 'Opus'` |

**El Manual de marca Jiku NO aplica a `opus-web`.** Habla del «gestor de proyectos de Grava» y
especifica pantallas que son de `web` (sidebar, stepper de requisito, matriz de asignación); de
Opus no dice nada.

El criterio es el mismo que sostiene esta ADR: **Opus es de cara al cliente y Jiku es interno.**
Unificar la identidad haría que el cliente vea la marca interna de Grava — lo contrario de lo que
el aislamiento busca. El propio manual de Jiku ya razona así: «Jiku firma el producto; Grava firma
la organización. Nunca se combinan en un mismo bloque.»

**Consecuencia operativa:** un cambio de Design System se aplica **a una superficie, nunca a las
dos**. `/product-design-system-update` pregunta sobre cuál se itera, y los versionados son
independientes (`web` v2.1.0, `opus-web` v0.1.0).

## Implementation Rules

- Un cambio de identidad visual **DEBE** aplicarse a una sola superficie. **NO SE DEBE** portar la
  paleta, la tipografía ni la firma de Jiku a `opus-web`, ni al revés.
- Todo endpoint de cara al cliente **DEBE** vivir bajo `/api/opus/*`. **NO SE DEBE** exponer un
  endpoint interno al portal agregándole un filtro por rol.
- Todo endpoint bajo `/api/opus/*` **DEBE** verificar el permiso de proyecto con
  `validateProjectPermissions` o equivalente. El rol solo no alcanza.
- Un endpoint que devuelva actividad al portal **DEBE** filtrar por `visibilityLevel: 'public'`.
- El portal **NO DEBE** exponer campos de horas, minutos ni costo en ninguna respuesta.
- La visibilidad de una actividad de cambio de campo **DEBE** calcularla el servidor
  (`visibility-helper.ts`): `state`, `title` y `description` → `public`; el resto → `internal`.
  Solo los comentarios aceptan visibilidad elegida por el usuario.
- Un tipo de entidad nuevo con adjuntos **DEBE** agregarse a la resolución de proyecto de
  `attachments-access.ts`. Un tipo no contemplado **NO** se autoriza — que es el comportamiento
  seguro, y es lo que hoy pasa con los adjuntos históricos de `stage`.
- **NO SE DEBE** confiar en el frontend para el aislamiento. `opus-web` no corta navegación por
  rol a propósito: el filtro es de datos.

## Consecuencias

### Positivas

- **El aislamiento no depende del renderizado.** Un bug de UI en el portal no puede mostrar datos
  que la api no le mandó, porque nunca llegan al navegador.
- **Superficie de ataque reducida.** El portal solo puede llamar a 12 endpoints; los 49 internos no
  están en su superficie aunque alguien manipule el cliente.
- **Cada frontend se optimiza para su audiencia** sin condicionales cruzados: el portal es un
  tablero de requisitos con tres vistas, el interno una herramienta de trabajo de 25 rutas.
- **Despliegue y dominio independientes.** Se puede desplegar uno sin el otro.
- **La separación es evidente al leer el código**: no hay que rastrear condicionales de rol para
  saber qué ve un cliente.

### Negativas

- **Dos frontends que mantener**, con stack duplicado y dependencias que actualizar dos veces.
- **Código y decisiones divergentes.** Los dos resuelven los mismos problemas de formas distintas
  (Server Actions vs proxy catch-all, layout vs middleware, `AUTH_*` vs `NEXTAUTH_*`), sin
  evidencia de cuál es la preferida. Ver [ADR-009](ADR-009-token-confinado-al-servidor.md).
- **Duplicación de conceptos de dominio.** Los 7 estados de requisito están declarados en los dos
  frontends, y tres veces dentro de `opus-web`.
- **El equipo interno puede entrar al portal.** No hay corte por rol en `opus-web`, así que un
  `user` o `admin` que abra Opus puede cambiar estado y prioridad inline. **No se sabe si es
  intencional** (pregunta abierta 4).

### Riesgos

- **Riesgo:** el proxy catch-all de `opus-web` no filtra paths ni métodos: expone toda la
  superficie de `/api/opus/*` a cualquier usuario logueado.
  - **Mitigación:** la api autoriza por rol y por entidad en cada endpoint. Es suficiente **solo
    si esa regla se cumple sin excepción**. Registrado en NFR-S08 y FG-4.
- **Riesgo:** un endpoint nuevo bajo `/api/opus/*` se agrega sin `validateProjectPermissions` y
  queda accesible a cualquier cliente para cualquier proyecto.
  - **Mitigación:** ninguna automática hoy. Un test que recorra las rutas de `/api/opus/*` y
    verifique la presencia del middleware sería la verificación correcta.
- **Riesgo:** un campo de horas se filtra al portal en una respuesta nueva.
  - **Mitigación:** los tipos de `opus-web` no lo declaran, pero la api no lo impide.

## Alternativas Consideradas

### Alternativa 1: Una sola aplicación con secciones por rol

**Pros:**
- Un frontend que mantener, sin duplicación de stack ni de conceptos
- Un solo despliegue

**Cons:**
- La separación queda a nivel de renderizado: un condicional mal puesto filtra datos
- El bundle del cliente incluiría código y tipos de secciones internas
- Toda ruta nueva exige recordar el corte por rol

**Por qué se descartó:** el dato en juego (horas, y por lo tanto costo interno) hace que un fallo
de renderizado sea inaceptable. La separación tenía que ser estructural.

---

### Alternativa 2: Mismos endpoints con filtrado por rol

**Pros:**
- Sin duplicación de handlers
- Un cambio de modelo se refleja en las dos superficies

**Cons:**
- Cada endpoint carga la responsabilidad de recordar qué omitir para un externo
- Un campo nuevo se filtra por default: hay que acordarse de excluirlo
- La superficie del cliente sería tan grande como la interna

**Por qué se descartó:** invierte el default de seguridad. Con superficies separadas, lo que un
cliente ve es exactamente lo que alguien decidió exponer.

---

### Alternativa 3: Un servicio backend separado para el portal

**Pros:**
- Aislamiento aún más fuerte, incluso a nivel de proceso
- Podría escalar independientemente

**Cons:**
- Un tercer backend con su despliegue, su conexión y su autenticación
- Compartiría la base de todos modos, así que el aislamiento real seguiría siendo el de
  `user_project_permissions`

**Por qué se descartó:** desproporcionado. El aislamiento adicional sería mínimo frente al costo,
porque la frontera efectiva es el permiso por proyecto, que ya existe.

## Referencias

- Superficie del portal: [`docs/apis/api.yaml`](../apis/api.yaml) (los 12 endpoints `/api/opus/*`)
- Aislamiento: `user_project_permissions` en [`docs/db-schemas/jiku.md`](../db-schemas/jiku.md)
- Arquitectura: [`docs/prd/architecture.md`](../prd/architecture.md)
- ADRs relacionados: [ADR-008](ADR-008-autorizacion-deny-by-default.md), [ADR-009](ADR-009-token-confinado-al-servidor.md)
