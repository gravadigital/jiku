import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * El firmador de S3 de `core`: DOS OPERACIONES Y NADA MÁS, firmar un PutObject y firmar un
 * GetObject.
 *
 * NO HACE RED. El SDK firma localmente con las credenciales, sin contactar el bucket. Eso es
 * lo que permite firmar dentro de la transacción del despachador sin arriesgar el timeout de
 * 5 s de ADR-002 — y es la misma razón por la que el byte NO se verifica con un `headObject`
 * (D-13): eso sí sería una llamada de red.
 *
 * NO IMPLEMENTES `uploadFromBuffer`, `getFileStream`, `deleteFile`, `listByPrefix` NI
 * `headObject`. `core` firma; no mueve bytes. Cada operación de más es superficie que después
 * hay que justificar. El `StorageService` de la api tiene seis operaciones porque proxea el
 * byte; esta story lo reemplaza justamente para que deje de hacerlo.
 */

/**
 * Prefijo de las claves. El default histórico se conserva a propósito.
 *
 * ADVERTENCIA, Y ESTE ES EL ÚNICO LUGAR DONDE QUEDA: cambiar `STORAGE_S3_KEY_PREFIX` en una
 * instalación con datos deja INACCESIBLES todos los archivos existentes, porque las claves ya
 * persistidas en `files.storage_key` siguen apuntando al prefijo viejo. Desde REQ-001 la
 * variable la lee un solo servicio, así que esta nota no está duplicada en ningún otro lado.
 */
export const DEFAULT_KEY_PREFIX = 'grava-gestion';

export type Disposition = 'inline' | 'attachment';

export interface StorageSigner {
  /** Bucket configurado, para poblar `files.storage_bucket`. */
  readonly bucket: string;
  /** Región configurada, para poblar `files.storage_region`. */
  readonly region: string;
  /** Prefijo de las claves, para construirlas. */
  readonly keyPrefix: string;

  signUpload(key: string, mimeType: string, expiresIn: number): Promise<string>;

  signDownload(
    key: string,
    fileName: string,
    disposition: Disposition,
    expiresIn: number
  ): Promise<string>;
}

/**
 * Escapa el nombre para que viaje dentro de `filename="..."` sin romper el header que S3 va a
 * emitir. Es entrada de usuario que termina en un header HTTP: no se concatena cruda.
 *
 * Las comillas dobles y las barras invertidas se escapan; los caracteres de control se
 * eliminan porque un CR o LF en un header es inyección de encabezados. Para nombres no-ASCII
 * el estándar completo es `filename*=UTF-8''<percent-encoded>`, que se agrega abajo en
 * paralelo al `filename` simple: los clientes que entienden RFC 5987 usan el primero y el
 * resto cae al segundo.
 */
export function contentDisposition(disposition: Disposition, fileName: string): string {
  const sanitized = fileName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const encoded = encodeURIComponent(fileName);

  return `${disposition}; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}

/**
 * Construye la clave del objeto. LA POLÍTICA ES DE `core`: quien sube NO elige dónde se
 * guarda el archivo (D-08), y por eso un cliente no puede escribir fuera de su namespace ni
 * sobreescribir el objeto de otro.
 *
 * La forma es `{prefix}/f/{uuid}{ext}`, SIN `entityType` ni `entityId` (D-02): el archivo
 * existe antes de saber a qué se vincula. El namespace `/f/` separa lo nuevo del legado, y su
 * único propósito es que un backfill NO PUEDA colisionar con una clave existente — nadie
 * parsea la clave para distinguir un archivo viejo de uno nuevo.
 *
 * EL `fileName` NO PARTICIPA DE LA CLAVE, solo su extensión. Eso es lo que hace que un
 * `../../etc/passwd.pdf` produzca una clave con un uuid y `.pdf`, sin rastro del path. NO
 * concatenes el `fileName` a la clave por ninguna razón.
 */
export function buildStorageKey(fileName: string, keyPrefix: string): string {
  // Un `fileName` sin extensión da `''` y la clave queda sin sufijo: es válido, y la
  // validación de extensión del comando ya lo rechazó antes de llegar acá.
  const extension = path.extname(fileName).toLowerCase();
  return `${keyPrefix}/f/${randomUUID()}${extension}`;
}

class S3StorageSigner implements StorageSigner {
  readonly bucket: string;
  readonly region: string;
  readonly keyPrefix: string;
  private readonly client: S3Client;

  constructor() {
    const endpoint = process.env.STORAGE_S3_ENDPOINT;
    const accessKeyId = process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY;
    const secretAccessKey = process.env.STORAGE_S3_CREDENTIALS_SECRETKEY;
    const bucket = process.env.STORAGE_S3_BUCKETNAME;
    const region = process.env.STORAGE_S3_REGION;
    const forcePathStyle = process.env.STORAGE_S3_FORCEPATHSTYLE === 'true';

    // Sin defaults: el endpoint, el bucket y la región dependen del proveedor de cada
    // instalación (AWS S3, MinIO, Spaces, R2). Un default acá apuntaría a la infraestructura
    // de otro, y el error recién aparecería al firmar el primer archivo.
    const missing = [
      ['STORAGE_S3_ENDPOINT', endpoint],
      ['STORAGE_S3_CREDENTIALS_ACCESSKEY', accessKeyId],
      ['STORAGE_S3_CREDENTIALS_SECRETKEY', secretAccessKey],
      ['STORAGE_S3_BUCKETNAME', bucket],
      ['STORAGE_S3_REGION', region],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Falta configuración de storage S3: ${missing.join(', ')}`);
    }

    this.bucket = bucket as string;
    this.region = region as string;
    this.keyPrefix = process.env.STORAGE_S3_KEY_PREFIX || DEFAULT_KEY_PREFIX;

    this.client = new S3Client({
      endpoint,
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
      forcePathStyle,
    });
  }

  signUpload(key: string, mimeType: string, expiresIn: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  signDownload(
    key: string,
    fileName: string,
    disposition: Disposition,
    expiresIn: number
  ): Promise<string> {
    // `ResponseContentDisposition` es lo que hace que el nombre original viaje FIRMADO en la
    // URL y S3 lo devuelva sin que nadie proxee el byte ni arme el header (CA-13).
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(disposition, fileName),
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}

let signer: StorageSigner | null = null;

/**
 * Devuelve el firmador, construyéndolo al PRIMER USO.
 *
 * DIFERENCIA DELIBERADA CON `api/lib/utils/storage-service.ts`, que hace
 * `export default new StorageService()` y lanza si falta configuración: allá el módulo se
 * instancia al importarse. Si `core` copiara ese patrón, el firmador se construiría al cargar
 * el módulo del comando, y en el entorno de tests —que no tiene credenciales reales—
 * CUALQUIER import de la cadena rompería la suite entera, aunque el test no toque S3.
 *
 * La instanciación perezosa es lo que hace testeable esta story.
 */
export function getStorageSigner(): StorageSigner {
  if (signer === null) {
    signer = new S3StorageSigner();
  }
  return signer;
}

/** Punto de inyección para los tests: reemplaza el firmador por un doble. */
export function setStorageSigner(replacement: StorageSigner | null): void {
  signer = replacement;
}
