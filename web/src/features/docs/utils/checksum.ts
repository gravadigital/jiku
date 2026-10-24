// `Blob.arrayBuffer()` existe en todos los navegadores vigentes; el respaldo con `FileReader`
// cubre entornos (jsdom) que todavía no lo implementan.
const readBytes = (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
};

/** `sha256:` + hex en minúsculas del binario, calculado en el navegador (DD-8). */
export async function sha256Checksum(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await readBytes(blob));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}
