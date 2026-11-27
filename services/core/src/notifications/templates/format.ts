/**
 * Helpers compartidos por las cuatro plantillas (REQ-015/S-073): interpolación del `subject`,
 * escapado de HTML, y la representación única de un valor ausente (CA-9).
 *
 * ESTE ARCHIVO VIVE EN `templates/`, NO EN `dispatch/`: a diferencia de `dispatch/`, este módulo
 * SÍ puede nombrar conceptos de notificación (no tipos de dominio) porque no participa del gate
 * estructural de CA-10.
 */

/**
 * La representación de "no hay valor" se decide UNA sola vez acá, y las cuatro plantillas la
 * usan para cualquier campo opcional (`project.name`, hoy el único caso real). CA-9 exige "el
 * mismo criterio para ambos casos" (`project.name` null y `actor.name` que es un id) — el
 * segundo caso no necesita este helper porque un id SIEMPRE es una representación válida (nunca
 * es `null`/`undefined`), pero el criterio de fondo es el mismo: nunca lanzar, nunca inventar
 * un texto grande, y nunca dejar pasar `null`/`undefined` tal cual al cuerpo del mail.
 *
 * Se eligió un texto neutro y corto ("sin proyecto") en vez de omitir el bloque entero: un mail
 * que menciona el proyecto para unos casos y lo omite para otros sería más difícil de leer que
 * uno que siempre lo menciona, con un texto honesto cuando no hay dato.
 */
export function textoODefecto(valor: string | null | undefined, defecto: string): string {
  return valor === null || valor === undefined || valor === '' ? defecto : valor;
}

/**
 * Interpolación mínima y propia de `{{clave}}` contra un objeto plano. Deliberadamente NO se trae
 * una librería de plantillas: el servicio no tiene ninguna y agregar una por cuatro strings con
 * un único marcador vigente (`{{title}}`) no se paga.
 *
 * Una clave del payload ausente en `values` deja el marcador SIN reemplazar, así que las
 * plantillas tienen que pasar siempre los valores que sus `subject` usan — no hay un fallback
 * silencioso acá, porque un `{{title}}` colgado en el asunto es más fácil de notar en QA que un
 * texto de reemplazo genérico que nadie pide.
 */
export function interpolar(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (match, clave: string) =>
    Object.prototype.hasOwnProperty.call(valores, clave) ? valores[clave] : match
  );
}

/**
 * Escapado de HTML propio y explícito, por los cinco caracteres que rompen el documento o abren
 * una inyección (CA-8: un título con `<script>` no se inyecta). El `&` va primero: escapar los
 * otros cuatro generaría `&amp;` en cada uno si se hiciera al revés.
 *
 * El `text` (plano) NUNCA pasa por acá: un `&amp;` en un mail de texto sería el bug inverso.
 */
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
