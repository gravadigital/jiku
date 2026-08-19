---
document: UX Survey Screen
screen: home-vacia
route: /
service: web
source_files:
  - src/app/page.tsx
  - src/app/layout.tsx
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: home-vacia

> **Relevamiento as-is** de `/`, extraído de `src/app/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.

## Identidad

- **Ruta:** `/`
- **Archivo:** `src/app/page.tsx` (Server Component, 13 líneas)
- **Requiere auth:** **no.** Está fuera de `(loggedin)`, así que no tiene guard. Se ve sin sesión
- **Audiencia:** no determinable desde el código
- **Propósito observado:** ninguno funcional. Renderiza el texto `"Home"` en un `<h1>`.
- **Viewports con tratamiento:** ninguno.

## Entrada y salida

**Entradas:**
- **Redirect desde `/login/enter` al terminar el login** · `login/enter/page.tsx:8` — es el destino
  del flujo de autenticación completo
- Click en el logo de la aplicación, desde cualquier pantalla autenticada · `Navbar.tsx:190`
- Navegación directa a la raíz del dominio

**Salidas:**
- **Ninguna.** La pantalla no tiene links, botones ni navegación. **No hay forma de salir de acá
  desde la propia pantalla.**

**Redirects automáticos:**
- Ninguno activo. Existe uno comentado:
  ```tsx
  // src/app/page.tsx:3-9
  /*
  import {redirect} from 'next/navigation';
  export default function Home() {
    redirect('/clients');
  }
  */
  ```

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | titulo-home | `heading` | h1 | ambos | `<h1>Home</h1>` | `app/page.tsx:12` |

Un solo bloque. **Sin sidebar, sin navegación, sin ningún otro elemento**: la ruta está fuera de
`(loggedin)`, así que el shell no se monta.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- titulo-home

Sin contenedor, sin padding propio, sin módulo SCSS. El `<h1>` queda pegado al borde superior
izquierdo del viewport, con los estilos globales de `globals.scss:189-194`
(`font-size: 2rem; line-height: 2rem; font-weight: 800`) y el `margin: 0` del reset.

**Origen:** `app/page.tsx:11-13` — no hay ningún elemento de layout.

## Contenido

### titulo-home
- Texto/label: `"Home"`
- Origen: `app/page.tsx:12` (hardcodeado, en inglés — el resto del producto está en español)
- Icono: ninguno
- Annotation: ninguno. Es texto estático.

## Estados presentes

### default
- Mensaje: `"Home"`
- Disparado por: cualquier visita a `/`
- Origen: `app/page.tsx:11-13`
- Cambios: ninguno. Es el único estado posible.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty | no aplica: no hay datos que listar | — |
| loading | no aplica: no hay datos que traer | — |
| error de validación | no aplica: no hay inputs | — |
| error de sistema | no aplica: no puede fallar. No hay `error.tsx` en `app/`, pero tampoco hay nada que lance | no existe `app/error.tsx` |
| success | no aplica | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |
| **sesión** | **la pantalla no distingue si hay sesión o no.** Un visitante anónimo y un usuario recién logueado ven exactamente lo mismo | `app/page.tsx` no llama a `auth()` |

## Interacciones

**Eventos:**
- Ninguno. No hay controles.

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | No aplica: no hay imágenes | — |
| Estructura semántica | Hay un `<h1>`, pero **no hay `<main>`** ni ningún landmark | `app/page.tsx:12` |
| Nombre de la página | El `<title>` viene de `metadata` en el layout raíz: `process.env.APP_NAME ?? 'Jiku'`. **No es específico de esta pantalla** | `app/layout.tsx:14` |
| Navegación por teclado | No hay ningún elemento enfocable en la pantalla. Un usuario de teclado no tiene a dónde tabular | `app/page.tsx:11-13` |
| `lang` del documento | `lang="en"` en el `<html>`, y el único texto de la pantalla también está en inglés (`"Home"`) — es la única pantalla donde coinciden | `app/layout.tsx:19` |

## Observaciones del relevamiento

- **Esta pantalla es el destino del login.** `/login/enter` hace `redirect('/')`
  (`login/enter/page.tsx:8`), así que el flujo de autenticación completo termina en un `<h1>Home</h1>`
  sin navegación ni salida. El usuario tiene que escribir una URL o usar el botón de atrás.
- **El `redirect('/clients')` comentado** (`app/page.tsx:3-9`) sugiere que la intención era llevar
  al listado de actores, pero **el código no dice por qué está comentado ni desde cuándo**. No se
  puede determinar si es temporal o si la home iba a tener contenido propio.
- **`import './globals.scss'` está repetido** en esta página (`app/page.tsx:1`) además de en el
  layout raíz (`app/layout.tsx:1`). No rompe nada; es redundante.
- **Está fuera del grupo protegido**, así que es visible sin sesión. No expone datos —el texto es
  estático— pero es la única ruta no-auth del producto que no cumple una función de autenticación.
- **A confirmar en consolidación:** cuál debería ser la pantalla de entrada tras el login. Es la
  decisión de UX más inmediata que este relevamiento deja abierta.
