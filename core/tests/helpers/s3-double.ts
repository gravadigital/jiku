import {
  Disposition,
  StorageSigner,
  contentDisposition,
  setStorageSigner,
} from '../../src/commands/files/storage';

/**
 * Doble del firmador de S3 para los tests de `files`.
 *
 * ES EL ÚNICO DOBLE DE LA STORY: la base NO se dobla. ADR-013 y la convención `testing` son
 * explícitos —los tests corren contra un PostgreSQL real, sin mocks de Sequelize.
 *
 * El doble firma URLs sintéticas SIN RED, lo cual es coherente con que la firma real tampoco
 * haga red: no está simulando algo que el sistema real hace de otra forma, está reemplazando
 * una operación puramente local por otra puramente local.
 *
 * SOBRE EL `caller` DE `dispatch()`: desde S-017 su default ES `CORE_TRUSTED_PUBLISHER_ID`. La
 * compuerta de autorización rechaza a todo caller sin fila en `users`, y el default anterior
 * (`'api'`) no la tenía. Los tests de la rama EXTERNA siguen pasando su caller explícitamente
 * —afirman sobre él— y sus filas de fixture llevan `roles: ['internal-app']`; lo que se
 * perdió es que un test que OLVIDE su caller ahora cae en la rama exenta y no en la externa.
 */

export interface SignCall {
  operation: 'PutObject' | 'GetObject';
  key: string;
  expiresIn: number;
  /** Solo en PutObject. */
  contentType?: string;
  /** Solo en GetObject. */
  responseContentDisposition?: string;
}

export class S3Double implements StorageSigner {
  readonly bucket = 'test-bucket';
  readonly region = 'us-east-1';
  readonly keyPrefix = 'grava-gestion';

  /** Todas las firmas pedidas, en orden. */
  readonly calls: SignCall[] = [];

  /** Cuántas veces se intentó una llamada de RED contra el bucket. Debe quedar en cero. */
  sendCount = 0;

  /** Si se fija, `signUpload`/`signDownload` rechazan con este error (TS-58). */
  failWith: Error | null = null;

  /**
   * Ninguna operación del firmador debe invocar esto. Existe para que los tests puedan
   * assertar CERO invocaciones de red (TS-47, TS-48, TS-49): si el código real la llamara,
   * el contador subiría y además lanzaría.
   */
  send(): never {
    this.sendCount += 1;
    throw new Error('[s3-double] send() invocado: la firma no debe hacer red');
  }

  signUpload(key: string, mimeType: string, expiresIn: number): Promise<string> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    this.calls.push({ operation: 'PutObject', key, expiresIn, contentType: mimeType });
    return Promise.resolve(`https://s3.test/${key}?X-Amz-Expires=${expiresIn}`);
  }

  signDownload(
    key: string,
    fileName: string,
    disposition: Disposition,
    expiresIn: number
  ): Promise<string> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    // El header se arma con el MISMO helper que usa el firmador real, para que los asserts de
    // escapado (TS-35) verifiquen el código de producción y no el doble.
    this.calls.push({
      operation: 'GetObject',
      key,
      expiresIn,
      responseContentDisposition: contentDisposition(disposition, fileName),
    });
    return Promise.resolve(`https://s3.test/${key}?X-Amz-Expires=${expiresIn}`);
  }

  /** Llamadas de una operación puntual. */
  callsOf(operation: SignCall['operation']): SignCall[] {
    return this.calls.filter((call) => call.operation === operation);
  }

  reset(): void {
    this.calls.length = 0;
    this.sendCount = 0;
    this.failWith = null;
  }
}

/**
 * Instala el doble y devuelve la instancia. Llamalo en un `beforeEach`; sin restaurar entre
 * tests, un stub que lanza (TS-58) contamina los siguientes y el fallo aparece lejos de su
 * causa.
 */
export function installS3Double(): S3Double {
  const double = new S3Double();
  setStorageSigner(double);
  return double;
}

/** Desinstala el doble, dejando que el firmador real vuelva a construirse al primer uso. */
export function uninstallS3Double(): void {
  setStorageSigner(null);
}
