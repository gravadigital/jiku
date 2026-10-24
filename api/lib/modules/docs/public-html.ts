import axios from 'axios';

export const SHARED_HTML_MAX_BYTES = 5 * 1024 * 1024; // DD-12: <= 5 MiB
export const SHARED_HTML_TIMEOUT_MS = 10_000;

/**
 * Descarga el HTML prefirmado de `shares.resolve` (`htmlUrl`, vence a los 300 s) cuando el documento
 * supera 256 KiB. Lanza ante cualquier falla. NUNCA loguea la URL: es una credencial prefirmada.
 */
export async function fetchSharedHtml(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('unsupported_protocol'), { code: 'unsupported_protocol' });
  }
  const res = await axios.get<string>(url, {
    responseType: 'text',
    transformResponse: (data) => data, // sin parseo JSON
    maxContentLength: SHARED_HTML_MAX_BYTES,
    timeout: SHARED_HTML_TIMEOUT_MS,
    maxRedirects: 0,
    validateStatus: (status) => status === 200,
  });
  return res.data;
}
