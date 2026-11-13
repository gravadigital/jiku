# `actor` completo hacia jiku-docs — qué cambia en una instalación existente

**Story:** S-089 · **Request:** REQ-019 · **Fecha:** 2026-10-25

Desde esta versión la api manda a jiku-docs el mismo `actor` que manda a core, para que jiku-docs
clasifique a la persona con los roles del token ya verificado y no con la fila de `users`. La
decisión está en la revisión de [ADR-015](../adrs/ADR-015-modulos-opcionales-del-bus.md) y los
recorridos, en los flujos [documentos-desde-la-web](../flows/documentos-desde-la-web.md) y
[lectura-por-link-compartido](../flows/lectura-por-link-compartido.md).

## Contrato HTTP

Sin cambios: mismas rutas, mismos status y mismos cuerpos.

## Bus

- Todo llamado de la api a jiku-docs en nombre de una persona lleva `actor` =
  `{ id, roles, name?, username?, email? }` (el de `buildActor(res.req)`, sin transformar). Antes
  llevaba solo `{ id }`.
- Sin identidad verificada la api responde 401 sin publicar (sin cambios).
- `shares.resolve` y `shares.attachment` (rutas públicas `/p/docs/*`) siguen sin `actor`.
- `@jiku/nats-protocol` y el auth-callout no cambian.

## Notes for existing installations

```markdown
### Notes for existing installations

- **Update jiku-docs before or together with the api.** The api now sends jiku-docs the full
  `actor` (`id`, `roles`, and `name`/`username`/`email` when the token carries them). A jiku-docs
  that predates decision D-11 accepts only `{ id }` and answers every documentation call with
  `invalid_fields` (400): documentation stops working in web and opus-web. Installations without
  jiku-docs are not affected.
- No new environment variables, no database migrations, no identity-provider role changes and no
  auth-callout changes.
```
