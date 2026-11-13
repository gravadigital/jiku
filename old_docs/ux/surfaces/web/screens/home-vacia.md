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
version: "1.1"
date: 2026-09-02
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
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
