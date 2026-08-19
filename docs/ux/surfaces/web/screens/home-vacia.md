---
name: home-vacia
surface: web
route: /
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Home vacía

## Identidad

- **Audiencia primaria:** equipo-interno. La ruta está fuera del grupo `(loggedin)`, así que no tiene guard y se ve sin sesión [fuente: código-existente].
- **JTBD / Propósito:** ninguno funcional. Renderiza el texto `"Home"` en un `<h1>`. Es el destino del flujo de autenticación completo: `/login/enter` hace `redirect('/')` [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: el layout es el mismo a cualquier ancho.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. Esta pantalla en particular está fuera del shell, pero comparte la política de la superficie.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Redirect desde `login-entrada` al terminar el login · `login/enter/page.tsx:8` [fuente: código-existente]
- Click en el logo de la aplicación, desde cualquier pantalla autenticada · `Navbar.tsx:190`
- Navegación directa a la raíz del dominio

**Salidas user-driven:**
- Ninguna. La pantalla no tiene links, botones ni navegación. No hay forma de salir de acá desde la propia pantalla [fuente: código-existente].

**Salidas automáticas:**
- Ninguna activa. Existe un `redirect('/clients')` comentado en `app/page.tsx:3-9` [fuente: código-existente].

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | titulo-home | heading | h1 | content | desktop | todos los estados | Único contenido de la pantalla |

**Origen:** `app/page.tsx:12`

Un solo bloque. Sin sidebar, sin navegación, sin ningún otro elemento: la ruta está fuera de `(loggedin)`, así que el shell no se monta [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- titulo-home

Sin contenedor, sin padding propio, sin módulo SCSS. El `<h1>` queda pegado al borde superior izquierdo del viewport, con los estilos globales de `globals.scss:189-194` (`font-size: 2rem; line-height: 2rem; font-weight: 800`) y el `margin: 0` del reset [fuente: código-existente].

**Las fracciones no son derivables:** no hay ningún elemento de layout (`app/page.tsx:11-13`).

## Contenido

### titulo-home
- Texto/label: `"Home"`
- Icono: nada
- Asset: nada
- Annotation: texto estático, hardcodeado en inglés — el resto del producto está en español (`app/page.tsx:12`) [fuente: código-existente]

## Estados

### default
- Aplica: Sí
- Mensaje: `"Home"`
- Cambios: ninguno. Es el único estado posible (`app/page.tsx:11-13`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). No existe `app/error.tsx` [fuente: código-existente].

### success
- Aplica: No — no implementado (ver gaps-as-is.md)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

### sesión (presente / ausente)
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no distingue si hay sesión o no: un visitante anónimo y un usuario recién logueado ven exactamente lo mismo; `app/page.tsx` no llama a `auth()` [fuente: código-existente].

## Interacciones

**Eventos:**
- Ninguno. No hay controles [fuente: código-existente].

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno.

## Accesibilidad

- **Orden de foco:** no hay ningún elemento enfocable en la pantalla. Un usuario de teclado no tiene a dónde tabular (`app/page.tsx:11-13`) [fuente: código-existente].
- **Landmarks y jerarquía:** hay un `<h1>` (titulo-home), pero **no hay `<main>`** ni ningún otro landmark (`app/page.tsx:12`) [fuente: código-existente].
- **Foco y teclado:** esta pantalla no dispara overlays, así que no introduce focus traps.
- **Propio de esta composición:** el `<title>` del documento viene de `metadata` en el layout raíz (`process.env.APP_NAME ?? 'Jiku'`, `app/layout.tsx:14`) y no es específico de esta pantalla. El `<html>` declara `lang="en"` (`app/layout.tsx:19`); es la única pantalla del producto donde el idioma del contenido (`"Home"`, en inglés) coincide con esa declaración [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
