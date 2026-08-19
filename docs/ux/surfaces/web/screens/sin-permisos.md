---
name: sin-permisos
surface: web
route: /unauthorized
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Sin permisos

## Identidad

- **Audiencia primaria:** equipo-interno. No está en `(loggedin)`, así que no tiene guard propio; en la práctica se llega con sesión válida pero rol insuficiente. Por el redirect que la alimenta, la ve quien tiene el rol `external-user` [fuente: código-existente].
- **JTBD / Propósito:** informa que la cuenta no tiene permisos para acceder a esta aplicación y ofrece cerrar sesión [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: una sola columna centrada, el layout es el mismo a cualquier ancho.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Redirect desde `(loggedin)/layout.tsx:19-21` cuando `session.user.roles` incluye `external-user` [fuente: código-existente]

**Salidas user-driven:**
- `/login` · submit de `boton-cerrar-sesion` · `unauthorized/page.tsx:19-22` — `signOut({ redirectTo: '/login' })` en una Server Action [fuente: código-existente]

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | contenedor-centrado | section | — | layout | desktop | todos los estados | Columna centrada en ambos ejes |
| 2 | titulo-sin-permisos | heading | h1 | content | desktop | todos los estados | Comunica la denegación |
| 3 | mensaje-sin-permisos | paragraph | body | content | desktop | todos los estados | Explica la causa |
| 4 | boton-cerrar-sesion | button | primary | input | desktop | todos los estados | Única acción posible: salir |

**Origen:** `unauthorized/page.tsx:5-15`, `unauthorized/page.tsx:16`, `unauthorized/page.tsx:17`, `unauthorized/page.tsx:18-38`

Los cuatro bloques usan estilos inline, no CSS Modules. Es la única pantalla del producto sin módulo SCSS [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- contenedor-centrado (`display: flex`, `flex-direction: column`, centrado en ambos ejes, `height: 100vh`, `gap: 1rem`)
  - titulo-sin-permisos
  - mensaje-sin-permisos
  - boton-cerrar-sesion

**Origen:** `unauthorized/page.tsx:6-14`.

**Las fracciones no son derivables:** es un flex centrado sin ancho declarado, así que cada bloque ocupa su ancho intrínseco. El `<p>` no tiene `max-width`, así que a anchos grandes la línea se estira sin límite de medida [fuente: código-existente].

## Contenido

### contenedor-centrado
- Texto/label: sin texto propio — es el contenedor
- Icono: nada
- Asset: nada
- Annotation: estilos inline con `fontFamily: 'var(--font-primary, sans-serif)'` (`unauthorized/page.tsx:6-14`)

### titulo-sin-permisos
- Texto/label: `"Acceso no autorizado"`
- Icono: nada
- Asset: nada
- Annotation: `fontSize: '1.5rem'`, `fontWeight: 600` inline — **no** los 2rem/800 del `h1` global (`unauthorized/page.tsx:16`) [fuente: código-existente]

### mensaje-sin-permisos
- Texto/label: `"Tu cuenta no tiene permisos para acceder a esta aplicación."`
- Icono: nada
- Asset: nada
- Annotation: `color: '#666'` inline — es el valor de `--color-text-muted`, escrito literal en vez de usar el token (`unauthorized/page.tsx:17`). El mensaje no dice qué hacer ni a dónde ir: no menciona `opus-web` (el portal que, según el README del servicio, corresponde a `external-user`) ni ofrece un link a él, ni indica a quién contactar [fuente: código-existente]

### boton-cerrar-sesion
- Texto/label: `"Cerrar sesión"`
- Icono: nada
- Asset: nada
- Annotation: `backgroundColor: '#e91e8c'` inline. Ese color no existe en la paleta: `--color-button` es `#DA2C6A` y `--color-link-primary` es `#ed2c6c` (`unauthorized/page.tsx:36`, `:28-31`) [fuente: código-existente]

## Estados

### default
- Aplica: Sí
- Mensaje: `"Acceso no autorizado"` + `"Tu cuenta no tiene permisos para acceder a esta aplicación."`
- Cambios: ninguno. Es el único estado (`unauthorized/page.tsx:4-40`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: No — no implementado (ver gaps-as-is.md). El `<form action>` es una Server Action: al enviar hay una ida al servidor sin ningún indicador. El botón no se deshabilita ni muestra spinner; no hay `useFormStatus` ni estado (`unauthorized/page.tsx:18-38`) [fuente: código-existente].

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). No hay inputs.

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). Si `signOut` falla no hay boundary: no existe `unauthorized/error.tsx` ni `app/error.tsx` [fuente: código-existente].

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El éxito es el redirect a `/login`.

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: Sí
- Mensaje: `"Acceso no autorizado"` + `"Tu cuenta no tiene permisos para acceder a esta aplicación."`
- Cambios: es, de hecho, el estado permanente de la pantalla: la única acción posible es salir con `boton-cerrar-sesion` (`unauthorized/page.tsx:18-38`) [fuente: código-existente]

### rol específico
- Aplica: No — no implementado (ver gaps-as-is.md). El mensaje es genérico: la pantalla no lee la sesión ni distingue por qué el acceso fue denegado, siempre dice lo mismo; `unauthorized/page.tsx` no llama a `auth()` [fuente: código-existente].

## Interacciones

**Eventos:**
- boton-cerrar-sesion · on submit → Server Action inline con `'use server'` que llama a `signOut({ redirectTo: '/login' })` · `unauthorized/page.tsx:19-22` [fuente: código-existente]

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno durante la acción. El único feedback es la navegación a `/login` al terminar [fuente: código-existente].

## Accesibilidad

- **Orden de foco:** boton-cerrar-sesion es el único elemento enfocable de la pantalla [fuente: código-existente].
- **Landmarks y jerarquía:** hay `<h1>` (titulo-sin-permisos) y `<p>`. **No hay `<main>`** ni ningún otro landmark (`unauthorized/page.tsx:5-15`) [fuente: código-existente].
- **Foco y teclado:** la pantalla no dispara overlays, así que no introduce focus traps. El botón no aplica `focus-ring` y usa `border: 'none'` inline; queda el outline por defecto del navegador (`unauthorized/page.tsx:26-34`) [fuente: código-existente].
- **Propio de esta composición:** el mensaje es texto normal, **sin `role="alert"` ni `aria-live`**; al llegar por redirect, un lector de pantalla lo lee en el orden del documento (`unauthorized/page.tsx:17`). El `<html>` declara `lang="en"` con el contenido en español (`app/layout.tsx:19`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
