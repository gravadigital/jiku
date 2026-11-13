---
foundation: logo
version: 1.0.1
last_updated: 2026-09-02
status: normativo
origin: Manual de marca Jiku v1.0 (septiembre 2026)
---

# Logotipo y marca (web)

> **Nueva foundation.** El Manual de marca Jiku v1.0 dedica seis páginas a la firma —variantes,
> resguardo, símbolo, fondos y usos incorrectos— y el Design System no tenía dónde registrarlas.

## Propósito

Define las variantes de la firma de Jiku, sus medidas mínimas, el área de resguardo y las reglas
del símbolo. Lo consumen quienes componen pantallas, documentos y presentaciones.

## La marca

**Jiku** es el gestor de proyectos de Grava: la herramienta donde actores, proyectos, requisitos,
tareas y horas conviven en un mismo eje.

- **Nombre** — del japonés *jiku* (軸), «eje». El nombre nombra la función del producto: el punto
  alrededor del cual gira el trabajo.
- **Bajada oficial** — «El eje es el proyecto». Se escribe en **versalitas** cuando acompaña al
  logotipo, y en **caja baja** cuando funciona como frase dentro de un texto.

## Variantes de firma

Tres variantes cubren todos los usos.

| Variante | Asset | Uso | Mínimo |
|---|---|---|---|
| **Firma con bajada** | `logo-jiku-bajada` | Institucional: portadas, presentaciones, documentos, firmas de correo | **160 px** / 45 mm de ancho |
| **Firma horizontal** | `logo-jiku` | Producto: sidebar y pantalla de login. **Reemplaza a `logo-grava.png`** | **120 px** / 32 mm de ancho |
| **Símbolo** | `simbolo-jiku` | Favicon y avatar de app | **16 px** / 6 mm |

**Formatos:** SVG para pantalla y web; PNG con transparencia para documentos; PDF vectorial para
imprenta.

**Cada variante existe en versión clara y oscura**, más el isotipo suelto. Los SVG de interfaz
viven en `web/src/assets/` (`jikuLogo.svg`, `jikuLogoDark.svg`, `jikuLogoFull.svg`,
`jikuLogoFullDark.svg`, `jikuSymbol.svg`) —donde ya viven los iconos y `gravaLogo.svg`—; el
favicon va a `web/public/` cuando se implemente.

### Jerarquía de uso

**Una sola firma por pieza.** Si hay símbolo en la cabecera, no se repite la firma en el pie.

### En interfaz

La firma del sidebar mide **26 px de alto**, acompañada del wordmark en **Sora 19/700** cuando el
ancho lo permite.

## Área de resguardo y medidas

La unidad de medida es **`x`**, la altura de la contraforma de la J.

- **Resguardo mínimo: `1x` en los cuatro lados.** Ningún elemento gráfico ni borde entra en el área
  de resguardo.
- **Escalado siempre proporcional.** Por debajo de los mínimos se usa el símbolo solo.

## El símbolo

Seis rombos girando alrededor de un centro vacío: **el eje**. Ese centro es parte del dibujo y
**nunca se rellena**.

- **`#61CCB9`** (verde agua) como **único** color de las piezas.
- Sin contorno, sin sombra, sin degradado.
- **Sin rotación:** el eje vertical siempre a plomo.
- En avatares circulares ocupa el **62 % del diámetro** sobre azul oscuro.
- Icono de app: símbolo centrado sobre azul oscuro, 62 % del lienzo, **radio 22 %**.

## Fondos permitidos

La firma se aplica sobre **blanco, niebla o azul oscuro**. Sobre azul oscuro **el wordmark pasa a
niebla; el símbolo no cambia nunca**.

| Fondo | Hex | Uso |
|---|---|---|
| Blanco | `#FFFFFF` | Superficies de tarjeta y documento |
| Niebla | `#F6F6F9` | Fondo de aplicación en modo claro |
| Azul oscuro | `#0B1934` | Login, cabeceras y modo oscuro |

**Panel decorativo de login** — azul oscuro + trama de puntos al 10 % y dos halos: verde agua
arriba a la izquierda, grafito abajo a la derecha. **Es el único fondo con textura del sistema.**
Reemplaza el gradiente `#EB1433 → #FEAE97` de la versión anterior.

## Usos incorrectos

Cualquier alteración de color, proporción o composición **invalida la firma**:

1. **No recolorear** el símbolo ni el wordmark.
2. **No deformar** ni escalar de forma no proporcional.
3. **No rotar** el símbolo: el eje va a plomo.
4. **No usar la firma sobre verde agua** ni sobre colores de sistema.
5. **No encerrar la firma en cajas** ni combinarla con otros logos.
6. **No agregar** sombras, contornos, brillos ni degradados.

## Coexistencia con otras marcas

- **Grava** — Jiku firma el producto; Grava firma la organización. **Nunca se combinan en un mismo
  bloque.**
- **Terceros** — GitLab, Mattermost, HedgeDoc y mailserver conservan su color original y **no se
  re-dibujan**.

## Accesibilidad

- El wordmark sobre azul oscuro alcanza **14.6:1** en niebla.
- **NO SE DEBE** poner la firma sobre verde agua: el contraste del wordmark no llega a AA.
- Todo logotipo en interfaz **DEBE** llevar texto alternativo («Jiku»); si es decorativo junto al
  wordmark en texto, `aria-hidden="true"`.
- Respetar el tamaño mínimo garantiza legibilidad; por debajo, símbolo solo.

## Ejemplos

- [Sidebar nav](../components/sidebar-nav.md) — firma horizontal a 26 px de alto.
- [Login](../patterns/login.md) — panel decorativo con firma con bajada.
- [Avatar](../components/avatar.md) — símbolo al 62 % del diámetro.

## Historial

- 2026-09-02 v1.0.1 — Corrección (story S-052): los SVG de interfaz ya viven en este repositorio
  (`web/src/assets/`), migrados desde `_new-design/`. Se corrige la afirmación de que los provee
  diseño y que no viven en el repo. No cambia ninguna regla normativa (PATCH sobre el DS).
- 2026-09-02 v1.0.0 — Foundation nueva, creada desde el Manual de marca Jiku v1.0: tres variantes
  de firma con sus mínimos, área de resguardo de `1x`, reglas del símbolo, fondos permitidos, seis
  usos incorrectos y coexistencia con Grava y terceros (MINOR sobre el DS).
