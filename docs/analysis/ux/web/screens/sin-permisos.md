---
document: UX Survey Screen
screen: sin-permisos
route: /unauthorized
service: web
source_files:
  - src/app/unauthorized/page.tsx
  - src/lib/auth.ts
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: sin-permisos

> **Relevamiento as-is** de `/unauthorized`, extraído de `src/app/unauthorized/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.

## Identidad

- **Ruta:** `/unauthorized`
- **Archivo:** `src/app/unauthorized/page.tsx` (Server Component con una Server Action inline)
- **Requiere auth:** no está en `(loggedin)`, así que no tiene guard propio. En la práctica se llega
  con sesión válida pero rol insuficiente
- **Audiencia:** no determinable desde el código. Por el redirect que la alimenta, la ve quien tiene
  el rol `external-user`
- **Propósito observado:** informa que la cuenta no tiene permisos y ofrece cerrar sesión.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- Redirect desde `(loggedin)/layout.tsx:19-21` cuando `session.user.roles` incluye `external-user`

**Salidas:**
- `/login` · disparado por `boton-cerrar-sesion` · `unauthorized/page.tsx:19-22` —
  `signOut({ redirectTo: '/login' })` en una Server Action

**Redirects automáticos:**
- Ninguno.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | contenedor-centrado | `section` | — | ambos | `<div>` con estilos inline | `unauthorized/page.tsx:5-15` |
| 2 | titulo-sin-permisos | `heading` | h1 | ambos | `<h1>` con estilos inline | `unauthorized/page.tsx:16` |
| 3 | mensaje-sin-permisos | `paragraph` | body | ambos | `<p>` con estilos inline | `unauthorized/page.tsx:17` |
| 4 | boton-cerrar-sesion | `button` | primary | ambos | `<form action={serverAction}>` + `<button type="submit">` con estilos inline | `unauthorized/page.tsx:18-38` |

> **Los cuatro bloques usan estilos inline**, no CSS Modules. Es la única pantalla del producto sin
> módulo SCSS.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- contenedor-centrado (`display: flex`, `flex-direction: column`, centrado en ambos ejes,
  `height: 100vh`, `gap: 1rem`)
  - titulo-sin-permisos
  - mensaje-sin-permisos
  - boton-cerrar-sesion

**Origen:** `unauthorized/page.tsx:6-14`:

```tsx
style={{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100vh', gap: '1rem',
  fontFamily: 'var(--font-primary, sans-serif)',
}}
```

Una sola columna centrada. **No hay fracciones de 12 columnas derivables:** es un flex centrado sin
ancho declarado, así que cada bloque ocupa su ancho intrínseco. A anchos angostos el `<p>` hace wrap
sin `max-width`, así que a 1920px la línea se estira a todo el ancho del texto sin límite de medida.

## Contenido

### titulo-sin-permisos
- Texto/label: `"Acceso no autorizado"`
- Origen: `unauthorized/page.tsx:16`
- Annotation: `fontSize: '1.5rem'`, `fontWeight: 600` inline — **no** los 2rem/800 del `h1` global

### mensaje-sin-permisos
- Texto/label: `"Tu cuenta no tiene permisos para acceder a esta aplicación."`
- Origen: `unauthorized/page.tsx:17`
- Annotation: `color: '#666'` inline — es el valor de `--color-text-muted`, escrito literal en vez
  de usar el token

> **El mensaje no dice qué hacer ni a dónde ir.** No menciona `opus-web` (el portal que, según el
> README del servicio, es el que corresponde a `external-user`) ni ofrece un link a él, ni indica
> a quién contactar.

### boton-cerrar-sesion
- Texto/label: `"Cerrar sesión"`
- Origen: `unauthorized/page.tsx:36`
- Icono: ninguno
- Annotation: `backgroundColor: '#e91e8c'` inline. **Ese color no existe en la paleta**:
  `--color-button` es `#DA2C6A` y `--color-link-primary` es `#ed2c6c`. Es un magenta cercano pero
  distinto a los dos.

## Estados presentes

### default
- Mensaje: `"Acceso no autorizado"` + `"Tu cuenta no tiene permisos para acceder a esta aplicación."`
- Disparado por: cualquier visita a la ruta
- Origen: `unauthorized/page.tsx:4-40`
- Cambios: ninguno. Es el único estado.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty | no aplica | — |
| loading | **ausente durante el logout.** El `<form action>` es una Server Action: al enviar hay una ida al servidor sin ningún indicador. El botón no se deshabilita ni muestra spinner | `unauthorized/page.tsx:18-38` — sin `useFormStatus` ni estado |
| error de validación | no aplica: no hay inputs | — |
| error de sistema | **si `signOut` falla, no hay boundary.** No existe `unauthorized/error.tsx` ni `app/error.tsx` | no existe ninguno de los dos archivos |
| success | no aplica: el éxito es el redirect a `/login` | — |
| not found | no aplica | — |
| estado terminal / readonly | **es, de hecho, un estado terminal**, y está bien modelado: la única acción posible es salir | `unauthorized/page.tsx:18-38` |
| **rol específico** | **el mensaje es genérico.** La pantalla no lee la sesión ni distingue por qué el acceso fue denegado; siempre dice lo mismo | `unauthorized/page.tsx` no llama a `auth()` |

## Interacciones

**Eventos:**
- boton-cerrar-sesion · submit → Server Action inline con `'use server'` que llama a
  `signOut({ redirectTo: '/login' })` · `unauthorized/page.tsx:19-22`

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno durante la acción. El único feedback es la navegación a `/login` al terminar.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | No aplica: no hay imágenes | — |
| Estructura semántica | Hay `<h1>` y `<p>`. **No hay `<main>`** ni ningún landmark | `unauthorized/page.tsx:5-15` |
| Nombre accesible del botón | Presente (`"Cerrar sesión"` como texto) | `unauthorized/page.tsx:36` |
| Anuncio del mensaje | El mensaje es texto normal, sin `role="alert"` ni `aria-live`. Al llegar por redirect, un lector de pantalla lo lee en el orden del documento — aceptable para una navegación completa | `unauthorized/page.tsx:17` |
| Focus visible | Sin `focus-ring`; queda el outline por defecto del navegador. El botón usa `border: 'none'` inline | `unauthorized/page.tsx:26-34` |
| Contraste del mensaje | `#666` sobre blanco ≈ 5.7:1 — pasa AA para texto normal. No verificado formalmente | `unauthorized/page.tsx:17` |
| Contraste del botón | Blanco sobre `#e91e8c` ≈ 3.9:1 — **por debajo de 4.5:1 de AA para texto normal a 1rem**. No verificado formalmente | `unauthorized/page.tsx:28-31` |
| `lang` del documento | `lang="en"` con contenido en español | `app/layout.tsx:19` |

## Observaciones del relevamiento

- **Es la única pantalla con todos sus estilos inline.** No tiene `.module.scss`, usa tres valores
  de color literales (`#666`, `#e91e8c`, y el fallback `sans-serif`) y redefine el tamaño del `h1`.
  Se comporta como una pantalla escrita aparte del resto del sistema.
- **El color `#e91e8c` del botón no está en la paleta.** Ni `--color-button` (`#DA2C6A`) ni
  `--color-link-primary` (`#ed2c6c`). No se puede determinar de dónde salió.
- **`fontFamily: 'var(--font-primary, sans-serif)'`** declara un fallback que las demás pantallas no
  necesitan porque heredan del `<body>`. Sugiere que fue escrita asumiendo que podía renderizarse
  fuera del layout raíz — pero está dentro.
- **Contradicción con el README del servicio.** El README dice: *"An `external-user` reaching this
  frontend sees a reduced navigation, but the portal they are meant to use is `opus-web`"*. El
  código **no** muestra navegación reducida: el layout redirige acá antes de renderizar el `Navbar`,
  y el filtrado por rol de `Navbar.tsx:158-165` es código inalcanzable. Dos fuentes que dicen cosas
  distintas; el código es el que corre.
- **La pantalla no ofrece el camino correcto.** Sabe que el usuario es `external-user` (implícito en
  el redirect que lo trajo) y no le dice que su portal es `opus-web` ni le da un link. A confirmar en
  consolidación si debería.
- **A confirmar en consolidación:** si el mensaje debería diferenciar "no tenés permiso para esta
  app" de "no tenés permiso para esta sección", y si corresponde enlazar a `opus-web`.
