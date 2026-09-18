import { escapeHtml } from './format';

/**
 * El layout HTML compartido por las cuatro plantillas (diseño `templates-email-jiku/`, v2).
 *
 * POR QUÉ UN LAYOUT COMPARTIDO Y NO EL MARKUP EN CADA PLANTILLA: las cuatro plantillas tienen el
 * MISMO esqueleto (encabezado, etiqueta, título, párrafos, botón, pie) y difieren solo en el
 * texto. Pegar ~90 líneas de tablas en cada una las volvería cuatro copias que divergen en el
 * primer retoque de diseño — el mismo criterio con el que `format.ts` ya centraliza el escapado y
 * el texto por defecto. Una plantilla concreta declara QUÉ dice; este archivo decide CÓMO se ve.
 *
 * POR QUÉ TABLAS Y ESTILOS EN LÍNEA, que en cualquier otro contexto serían un error: es el
 * requisito real de los clientes de correo. Outlook (motor de Word) no soporta `flex`, `grid` ni
 * casi nada de CSS moderno, y Gmail DESCARTA el `<style>` del `<head>` en varias de sus vistas.
 * El diseño de origen ya viene resuelto así y no se "moderniza" acá: hacerlo rompe el render en
 * los clientes que más se usan. Las únicas reglas que van en `<style>` son las de `@media` y los
 * `:hover`, que no pueden expresarse en línea y que degradan sin romper nada donde se ignoran.
 *
 * LA PALETA, tomada del diseño y usada como único origen de verdad de los colores:
 *   #0B1934  azul noche — fondo del encabezado y texto de títulos
 *   #12897A  verde oscuro — etiqueta de sección y enlaces de texto
 *   #61CCB9  verde claro — fondo del botón principal
 *   #F6F6F9  gris de fondo — lienzo exterior y pie
 *   #4F5865  gris de cuerpo — párrafos
 *   #6D727B  gris tenue — pie
 *   #DFE1E7  gris de borde — borde de la tarjeta y separador del pie
 *
 * NO HAY LOGO Y ES DELIBERADO (decisión del usuario, v2 del diseño): el encabezado lleva el
 * wordmark "Jiku" como TEXTO. Una imagen exigiría hospedarla en una URL pública y una variable de
 * entorno nueva para apuntarla; un `<img>` roto en el encabezado de cada mail es peor que un
 * wordmark tipográfico, y muchos clientes bloquean imágenes remotas por defecto igual.
 */

/** La paleta del diseño, en un solo lugar: un cambio de color no se persigue por cuatro archivos. */
const COLOR = {
  noche: '#0B1934',
  verdeOscuro: '#12897A',
  verdeClaro: '#61CCB9',
  fondo: '#F6F6F9',
  cuerpo: '#4F5865',
  tenue: '#6D727B',
  borde: '#DFE1E7',
  blanco: '#FFFFFF',
} as const;

const FUENTE = 'Helvetica,Arial,sans-serif';

/**
 * Lo que una plantilla concreta le pasa al layout. Todos los campos son TEXTO PLANO SIN ESCAPAR:
 * el layout escapa lo que corresponde, y centralizarlo acá evita el bug de una plantilla que
 * escapa dos veces (y muestra `&amp;` al destinatario) o ninguna (y abre la inyección de CA-8).
 *
 * `parrafos` son PÁRRAFOS DE TEXTO PLANO, no HTML: quien escribe una plantilla no puede inyectar
 * markup por acá ni por accidente ni a propósito. Si algún día un párrafo necesita negrita, el
 * lugar de resolverlo es este archivo con un tipo nuevo, no abriendo la puerta al HTML crudo.
 */
export interface LayoutMail {
  /** La etiqueta chica en versales sobre el título. Ej.: 'NUEVO REQUISITO'. */
  etiqueta: string;
  /** El título grande del mensaje. Suele ser el título del requisito. */
  titulo: string;
  /** Los párrafos del cuerpo, en orden. Texto plano: el layout los escapa. */
  parrafos: string[];
  /** El texto del botón principal. Ej.: 'Ver el requisito'. */
  textoBoton: string;
  /** El destino del botón. Es el `payload.link` ya armado al encolar. */
  link: string;
  /**
   * Una cita destacada opcional: el comentario o el texto de resolución. Va en un bloque aparte,
   * visualmente separado del cuerpo, porque es texto de OTRA persona y conviene que se lea como
   * tal y no como parte de la voz del producto.
   */
  cita?: string;
}

/**
 * El bloque de cita, cuando la plantilla lo pide. Separado en su propia función porque es la
 * única parte opcional del layout: intercalarlo con un ternario dentro del template literal
 * grande volvería ilegible la estructura de la tabla.
 *
 * Usa `border-left` sobre una celda (y no un `<blockquote>`, que Outlook maneja con márgenes
 * propios impredecibles) para lograr la barra lateral del diseño.
 */
function bloqueCita(cita: string): string {
  return `
        <tr>
          <td class="pad" width="600" style="padding:4px 40px 8px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:14px 18px; background-color:${COLOR.fondo}; border-left:3px solid ${COLOR.verdeClaro}; border-radius:0 8px 8px 0; font-family:${FUENTE}; font-size:15px; line-height:24px; mso-line-height-rule:exactly; color:${COLOR.cuerpo}; font-style:italic;">
                  ${escapeHtml(cita)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/**
 * Arma el documento HTML completo de un mail a partir de sus partes.
 *
 * EL `preheader` ES EL PRIMER PÁRRAFO, y no un texto aparte: es la línea que los clientes muestran
 * junto al asunto en la bandeja de entrada. Repetir ahí el primer párrafo es lo que hace que la
 * vista previa diga algo útil en vez de "Ver el requisito" o el comienzo del markup.
 */
export function renderLayout(mail: LayoutMail): string {
  const parrafosHtml = mail.parrafos
    .map(
      (parrafo) =>
        `            <p style="margin:0 0 16px 0; font-family:${FUENTE}; font-size:16px; line-height:26px; mso-line-height-rule:exactly; color:${COLOR.cuerpo};">${escapeHtml(parrafo)}</p>`
    )
    .join('\n');

  const preheader = mail.parrafos.length > 0 ? escapeHtml(mail.parrafos[0]) : '';
  const linkSeguro = escapeHtml(mail.link);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Jiku</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 26px !important; line-height: 32px !important; }
  }
  a { color: ${COLOR.verdeOscuro}; }
  a:hover { color: ${COLOR.noche}; }
</style>
</head>
<body style="margin:0; padding:0; background-color:${COLOR.fondo};">

<span style="display:none; font-size:1px; color:${COLOR.fondo}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLOR.fondo};">
  <tr>
    <td align="center" style="padding:32px 12px 40px 12px;">

      <table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px; background-color:${COLOR.blanco}; border:1px solid ${COLOR.borde}; border-radius:16px;">

        <tr>
          <td class="pad" width="600" bgcolor="${COLOR.noche}" style="background-color:${COLOR.noche}; padding:22px 40px; border-radius:16px 16px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="left" width="300" style="font-family:${FUENTE}; font-size:20px; line-height:24px; mso-line-height-rule:exactly; font-weight:bold; letter-spacing:-0.3px; color:${COLOR.fondo};">
                  Jiku
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="pad" width="600" style="padding:40px 40px 8px 40px; font-family:${FUENTE};">
            <div style="font-family:${FUENTE}; font-size:11px; line-height:16px; mso-line-height-rule:exactly; letter-spacing:2px; text-transform:uppercase; color:${COLOR.verdeOscuro}; padding-bottom:14px;">
              ${escapeHtml(mail.etiqueta)}
            </div>
            <h1 class="h1" style="margin:0 0 18px 0; font-family:${FUENTE}; font-size:30px; line-height:36px; mso-line-height-rule:exactly; font-weight:bold; letter-spacing:-0.7px; color:${COLOR.noche};">
              ${escapeHtml(mail.titulo)}
            </h1>
${parrafosHtml}
          </td>
        </tr>
${mail.cita === undefined ? '' : bloqueCita(mail.cita)}
        <tr>
          <td class="pad" width="600" style="padding:16px 40px 36px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${COLOR.verdeClaro}" width="220" style="background-color:${COLOR.verdeClaro}; border-radius:10px;">
                  <a href="${linkSeguro}" style="display:block; width:220px; padding:15px 0; font-family:${FUENTE}; font-size:16px; line-height:20px; mso-line-height-rule:exactly; font-weight:bold; color:${COLOR.noche}; text-decoration:none; text-align:center;">
                    ${escapeHtml(mail.textoBoton)}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="pad" width="600" bgcolor="${COLOR.fondo}" style="background-color:${COLOR.fondo}; padding:20px 40px; border-top:1px solid ${COLOR.borde}; border-radius:0 0 16px 16px; font-family:${FUENTE}; font-size:12px; line-height:20px; mso-line-height-rule:exactly; color:${COLOR.tenue};">
            Correo automático enviado por Jiku. No respondas a esta dirección: los mensajes no se leen.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

export default renderLayout;
