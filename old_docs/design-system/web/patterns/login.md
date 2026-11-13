---
pattern: login
version: 1.0.0
last_updated: 2026-09-02
status: normativo
surface: web
origin: Manual de marca Jiku v1.0 — «Aplicaciones»
related:
  - input
  - button
  - logo (foundation)
---

# Pattern — Login

> **Normativo.** Es la pieza que más define el tono del producto y la que más cambia con la nueva
> marca: el panel pasa del gradiente rosa al azul oscuro con trama.

## Propósito

Autenticar a la persona, y ser la primera impresión de la identidad de Jiku.

## Composición

Dos mitades:

| Zona | Contenido |
|---|---|
| **Izquierda — panel decorativo** | Azul oscuro `#0B1934` + trama de puntos al 10 % + dos halos (verde agua arriba izquierda, grafito abajo derecha). [Firma con bajada](../foundations/logo.md#variantes-de-firma) y «El eje es el proyecto» |
| **Derecha — formulario** | Sobre blanco: campos de usuario y contraseña, y el botón de sesión |

**Es el único fondo con textura del sistema** (ver
[logo](../foundations/logo.md#fondos-permitidos)).

## Componentes que lo componen

| Componente | Uso |
|---|---|
| [Input](../components/input.md) | «Usuario» (`nombre.apellido`) y «Contraseña» — radio 10 px, alto 44 px |
| [Button](../components/button.md) | «Iniciar sesión» — variant `session`: radio **10 px**, alto **46 px** |
| [logo](../foundations/logo.md) | Firma con bajada en el panel, mínimo 160 px de ancho |
| [Loader](../components/loader.md) | El botón en state `loading` mientras autentica |

## Reglas de composición

- **El formulario va sobre blanco**, nunca sobre el panel texturado: el contraste del campo con la
  trama no es legible.
- **Un solo botón primario**, el de sesión.
- El error de autenticación va **junto al formulario**, no como overlay.
- La bajada «El eje es el proyecto» aparece **en el panel**, no repetida en el formulario
  ([una sola firma por pieza](../foundations/logo.md#jerarquía-de-uso)).

## Accesibilidad

- Ambos campos **DEBEN** tener `<label>` visible y asociado; el placeholder no alcanza.
- La contraseña **DEBE** usar `type="password"` con `autocomplete="current-password"`, y el usuario
  `autocomplete="username"`.
- **El error de credenciales DEBE** anunciarse en una región `aria-live` y **no** decir cuál de los
  dos campos falló —es requisito de seguridad y a la vez de claridad: «Usuario o contraseña
  incorrectos».
- El foco inicial va en el campo de usuario.
- `Enter` en cualquiera de los dos campos envía el formulario.
- **El panel decorativo es decorativo:** `aria-hidden="true"`. La firma del panel no aporta
  información que el formulario no dé.
- **Contraste:** niebla sobre azul oscuro **14.6:1** en el panel; azul oscuro sobre verde agua
  **9.8:1** en el botón.

## Guidelines de contenido

- **Labels:** «Usuario», «Contraseña».
- **Placeholder de usuario:** el formato — `nombre.apellido`.
- **Botón:** «Iniciar sesión».
- **Error:** «Usuario o contraseña incorrectos», sin exclamación.

## Do's & don'ts

**Do:**

- Mantener el formulario sobre blanco y el panel a la izquierda.
- Usar la variant `session` del botón (46 px), reservada a login y logout.
- Anunciar el error sin distinguir qué campo falló.

**Don't:**

- **NO SE DEBE** poner el formulario sobre el panel texturado.
- **NO SE DEBE** usar el gradiente rosa anterior (`#EB1433 → #FEAE97`): queda descontinuado.
- **NO SE DEBE** repetir la firma en las dos mitades.
- **NO SE DEBE** usar `logo-grava.png`: la firma del producto es `logo-jiku`.

## Migración

| Hoy | Pasa a |
|---|---|
| Panel con gradiente `#EB1433 → #FEAE97` | **Azul oscuro `#0B1934` + trama de puntos al 10 % + dos halos** |
| `logo-grava.png` | **`logo-jiku-bajada`** |
| Título del login en `--color-general-primary` `#FF3C3C` | `text.primary` sobre blanco |
| Errores del login en `#FF3C3C` | `state.urgent` |
| Panel derecho `--color-surface-light` `#f5f5f5` | Blanco |

## Patterns y componentes relacionados

- [logo](../foundations/logo.md) — variantes de firma, resguardo y el panel decorativo.
- [Button](../components/button.md) — variant `session`.
- [Input](../components/input.md) — los dos campos.

## Historial

- **1.0.0** (2026-09-02) — Pattern nuevo, desde el Manual de marca Jiku v1.0: panel decorativo en
  azul oscuro con trama reemplazando el gradiente rosa, formulario sobre blanco, botón de sesión de
  46 px (MINOR sobre el DS).
