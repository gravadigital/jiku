import 'mocha';
import 'should';
import { getStorageSigner, setStorageSigner } from '../../src/commands/files/storage';

/**
 * LA FORMA DE LA URL PREFIRMADA DE SUBIDA.
 *
 * El SDK de AWS v3 calcula un checksum CRC32 por defecto en `PutObject` (desde ~3.729) y, al
 * PREFIRMAR, lo mete como QUERY PARAM FIRMADO. Como al firmar todavía no hay cuerpo, el valor
 * es el CRC32 del contenido VACÍO: `AAAAAA==`.
 *
 * El resultado es que el objeto que el navegador sube nunca coincide con el checksum que la URL
 * declara, y el proveedor rechaza el PUT con 403. Y como una respuesta de error no lleva
 * cabeceras CORS, el navegador lo reporta como un fallo de CORS — un síntoma que apunta al
 * lugar equivocado y hace perder el tiempo configurando el bucket.
 *
 * Este test fija que la URL NO lleve esos parámetros. No se puede cubrir con el `S3Double`,
 * que reemplaza al firmador entero: hay que ejercitar el cliente real.
 */
describe('S3StorageSigner — forma de la URL prefirmada', () => {
  const ENV = {
    STORAGE_S3_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
    STORAGE_S3_CREDENTIALS_ACCESSKEY: 'AKIATESTTESTTEST',
    STORAGE_S3_CREDENTIALS_SECRETKEY: 'secreto-de-test',
    STORAGE_S3_BUCKETNAME: 'bucket-de-test',
    STORAGE_S3_REGION: 'sfo3',
  };

  const original: Record<string, string | undefined> = {};

  before(() => {
    for (const [key, value] of Object.entries(ENV)) {
      original[key] = process.env[key];
      process.env[key] = value;
    }
    // El firmador es un singleton perezoso: hay que descartar el que pueda haber quedado de
    // otro archivo para que se construya con las credenciales de test de acá.
    setStorageSigner(null);
  });

  after(() => {
    for (const key of Object.keys(ENV)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    // Y descartarlo al salir, para no filtrar estas credenciales al resto de la suite.
    setStorageSigner(null);
  });

  async function uploadParams(): Promise<URLSearchParams> {
    const signer = getStorageSigner();
    const url = await signer.signUpload('bucket-de-test/f/abc.png', 'image/png', 300);
    return new URL(url).searchParams;
  }

  it('no incluye el checksum CRC32 del cuerpo vacío', async () => {
    const params = await uploadParams();

    // `AAAAAA==` es el CRC32 del contenido vacío: su presencia ES el bug.
    (params.get('x-amz-checksum-crc32') === null).should.be.true();
    (params.get('x-amz-sdk-checksum-algorithm') === null).should.be.true();
  });

  it('no incluye ningún parámetro de checksum, de ningún algoritmo', async () => {
    const params = await uploadParams();

    const checksumParams = [...params.keys()].filter((key) =>
      key.toLowerCase().includes('checksum')
    );
    checksumParams.should.deepEqual([]);
  });

  it('sigue firmando lo que la subida necesita', async () => {
    const params = await uploadParams();

    params.get('X-Amz-Algorithm')!.should.equal('AWS4-HMAC-SHA256');
    params.get('X-Amz-Expires')!.should.equal('300');
    // Solo `host` va firmado: el navegador no tiene que mandar ninguna cabecera especial, así
    // que no hace falta declararla en el `AllowedHeader` del CORS del bucket.
    params.get('X-Amz-SignedHeaders')!.should.equal('host');
  });
});
