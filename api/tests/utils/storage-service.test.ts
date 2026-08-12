import 'mocha';
import 'should';
import mockery from 'mockery';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for constructor error cases (TS-2, TS-3)
// Each test needs a fresh module load with different env vars, so we use
// separate mockery cycles per describe block.
// ─────────────────────────────────────────────────────────────────────────────
describe('storage-service - constructor', () => {
  before(() => {
    mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });

    const MockS3Client = class {
      send() { return Promise.resolve({}); }
    };

    mockery.registerMock('@aws-sdk/client-s3', {
      S3Client: MockS3Client,
      PutObjectCommand: class { constructor(public params: any) {} },
      GetObjectCommand: class { constructor(public params: any) {} },
      DeleteObjectCommand: class { constructor(public params: any) {} },
      ListObjectsV2Command: class { constructor(public params: any) {} },
      HeadObjectCommand: class { constructor(public params: any) {} },
    });

    mockery.registerMock('@aws-sdk/s3-request-presigner', {
      getSignedUrl: async () => 'https://signed-url.example.com',
    });
  });

  after(() => {
    mockery.disable();
    delete process.env.STORAGE_S3_ENDPOINT;
    delete process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY;
    delete process.env.STORAGE_S3_CREDENTIALS_SECRETKEY;
  });

  // TS-2: Error por credenciales faltantes (ACCESSKEY)
  it('should throw error when STORAGE_S3_CREDENTIALS_ACCESSKEY is missing', () => {
    process.env.STORAGE_S3_ENDPOINT = 'https://s3.example.com';
    delete process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY;
    process.env.STORAGE_S3_CREDENTIALS_SECRETKEY = 'test-secret';

    // Clear Node module cache so the singleton re-instantiates with current env vars
    Object.keys(require.cache).forEach(key => {
      if (key.includes('storage-service')) delete require.cache[key];
    });
    (() => {
      require('../../lib/utils/storage-service');
    }).should.throw(/Missing S3 storage configuration/);
  });

  // TS-3: Error por endpoint faltante
  it('should throw error when STORAGE_S3_ENDPOINT is missing', () => {
    delete process.env.STORAGE_S3_ENDPOINT;
    process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY = 'test-key';
    process.env.STORAGE_S3_CREDENTIALS_SECRETKEY = 'test-secret';

    // Clear Node module cache so the singleton re-instantiates with current env vars
    Object.keys(require.cache).forEach(key => {
      if (key.includes('storage-service')) delete require.cache[key];
    });
    (() => {
      require('../../lib/utils/storage-service');
    }).should.throw(/Missing S3 storage configuration/);
  });

  // El bucket y la región pasaron a ser obligatorios: antes tenían un default que
  // apuntaba a la infraestructura de Grava.
  it('should throw error when STORAGE_S3_BUCKETNAME is missing', () => {
    process.env.STORAGE_S3_ENDPOINT = 'https://s3.example.com';
    process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY = 'test-key';
    process.env.STORAGE_S3_CREDENTIALS_SECRETKEY = 'test-secret';
    process.env.STORAGE_S3_REGION = 'us-east-1';
    delete process.env.STORAGE_S3_BUCKETNAME;

    Object.keys(require.cache).forEach(key => {
      if (key.includes('storage-service')) delete require.cache[key];
    });
    (() => {
      require('../../lib/utils/storage-service');
    }).should.throw(/Missing S3 storage configuration/);
  });

  it('should throw error when STORAGE_S3_REGION is missing', () => {
    process.env.STORAGE_S3_ENDPOINT = 'https://s3.example.com';
    process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY = 'test-key';
    process.env.STORAGE_S3_CREDENTIALS_SECRETKEY = 'test-secret';
    process.env.STORAGE_S3_BUCKETNAME = 'test-bucket';
    delete process.env.STORAGE_S3_REGION;

    Object.keys(require.cache).forEach(key => {
      if (key.includes('storage-service')) delete require.cache[key];
    });
    (() => {
      require('../../lib/utils/storage-service');
    }).should.throw(/Missing S3 storage configuration/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for all methods (TS-4 to TS-21)
// Singleton loaded once in `before`, mockS3Send is mutated per test.
// ─────────────────────────────────────────────────────────────────────────────
describe('storage-service', () => {
  let storageService: any;
  let mockS3Send: (command: any) => Promise<any>;
  let mockGetSignedUrl: (...args: any[]) => Promise<string>;

  before(() => {
    mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });

    mockS3Send = async () => ({});
    mockGetSignedUrl = async () => 'https://signed-url.example.com';

    const MockS3Client = class {
      send(command: any) { return mockS3Send(command); }
    };

    mockery.registerMock('@aws-sdk/client-s3', {
      S3Client: MockS3Client,
      PutObjectCommand: class { constructor(public params: any) {} },
      GetObjectCommand: class { constructor(public params: any) {} },
      DeleteObjectCommand: class { constructor(public params: any) {} },
      ListObjectsV2Command: class { constructor(public params: any) {} },
      HeadObjectCommand: class { constructor(public params: any) {} },
    });

    mockery.registerMock('@aws-sdk/s3-request-presigner', {
      getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
    });

    process.env.STORAGE_S3_ENDPOINT = 'https://s3.example.com';
    process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY = 'test-key';
    process.env.STORAGE_S3_CREDENTIALS_SECRETKEY = 'test-secret';
    process.env.STORAGE_S3_BUCKETNAME = 'test-bucket';
    process.env.STORAGE_S3_REGION = 'sfo2';

    storageService = require('../../lib/utils/storage-service').default;
  });

  after(() => {
    mockery.disable();
    delete process.env.STORAGE_S3_ENDPOINT;
    delete process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY;
    delete process.env.STORAGE_S3_CREDENTIALS_SECRETKEY;
    delete process.env.STORAGE_S3_BUCKETNAME;
    delete process.env.STORAGE_S3_REGION;
  });

  // ─── uploadFromBuffer ───────────────────────────────────────────────────────

  describe('uploadFromBuffer', () => {
    // TS-4: subida exitosa
    it('should return upload result when upload succeeds', async () => {
      mockS3Send = async () => ({ ETag: '"abc123"' });
      const buffer = Buffer.from('test content');
      const result = await storageService.uploadFromBuffer(
        'grava-gestion/objective/1/uuid.jpg',
        buffer,
        'image/jpeg'
      );
      result.should.have.property('key', 'grava-gestion/objective/1/uuid.jpg');
      result.should.have.property('bucket', 'test-bucket');
      result.should.have.property('etag', '"abc123"');
      result.should.have.property('size', buffer.length);
    });

    // TS-5: error de red
    it('should throw error when upload fails', async () => {
      mockS3Send = async () => { throw new Error('Network error'); };
      await storageService.uploadFromBuffer('key', Buffer.from('x'), 'text/plain')
        .should.be.rejectedWith(/Failed to upload file/);
    });
  });

  // ─── getFileStream ──────────────────────────────────────────────────────────

  describe('getFileStream', () => {
    // TS-6: archivo existente
    it('should return readable stream when file exists', async () => {
      const { Readable } = require('stream');
      const fakeStream = new Readable({ read() {} });
      mockS3Send = async () => ({ Body: fakeStream });
      const result = await storageService.getFileStream('grava-gestion/objective/1/uuid.jpg');
      result.should.be.instanceOf(Readable);
    });

    // TS-7: NoSuchKey
    it('should throw "File not found" error when NoSuchKey is returned', async () => {
      mockS3Send = async () => {
        const err: any = new Error('NoSuchKey');
        err.name = 'NoSuchKey';
        throw err;
      };
      await storageService.getFileStream('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith('File not found: grava-gestion/objective/1/uuid.jpg');
    });

    // TS-8: body vacío
    it('should throw "Empty response body" when Body is undefined', async () => {
      mockS3Send = async () => ({ Body: undefined });
      await storageService.getFileStream('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith(/Empty response body/);
    });
  });

  // ─── deleteFile ─────────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    // TS-9: eliminación exitosa
    it('should return { deleted: true } when file is deleted', async () => {
      mockS3Send = async () => ({});
      const result = await storageService.deleteFile('grava-gestion/objective/1/uuid.jpg');
      result.should.have.property('deleted', true);
    });

    // TS-10: idempotente
    it('should return { deleted: true } when key does not exist (idempotent)', async () => {
      mockS3Send = async () => ({}); // S3 DeleteObject does not throw for missing keys
      const result = await storageService.deleteFile('grava-gestion/objective/1/nonexistent.jpg');
      result.should.have.property('deleted', true);
    });

    // TS-11: error de red
    it('should throw error when delete fails', async () => {
      mockS3Send = async () => { throw new Error('Network error'); };
      await storageService.deleteFile('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith(/Failed to delete file/);
    });
  });

  // ─── listByPrefix ───────────────────────────────────────────────────────────

  describe('listByPrefix', () => {
    // TS-12: lista con archivos
    it('should return array of files when prefix has matches', async () => {
      const now = new Date();
      mockS3Send = async () => ({
        Contents: [
          { Key: 'grava-gestion/objective/123/a.jpg', Size: 100, LastModified: now },
          { Key: 'grava-gestion/objective/123/b.jpg', Size: 200, LastModified: now },
          { Key: 'grava-gestion/objective/123/c.jpg', Size: 300, LastModified: now },
        ],
        NextContinuationToken: undefined,
      });
      const result = await storageService.listByPrefix('grava-gestion/objective/123/');
      result.should.be.an.Array().with.length(3);
      result[0].should.have.property('key', 'grava-gestion/objective/123/a.jpg');
      result[0].should.have.property('size', 100);
    });

    // TS-13: paginación automática
    it('should accumulate results across pages when NextContinuationToken is returned', async () => {
      const now = new Date();
      let callCount = 0;
      mockS3Send = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            Contents: [{ Key: 'file1.jpg', Size: 100, LastModified: now }],
            NextContinuationToken: 'token-page-2',
          };
        }
        return {
          Contents: [{ Key: 'file2.jpg', Size: 200, LastModified: now }],
          NextContinuationToken: undefined,
        };
      };
      const result = await storageService.listByPrefix('prefix/');
      result.should.be.an.Array().with.length(2);
      result[0].should.have.property('key', 'file1.jpg');
      result[1].should.have.property('key', 'file2.jpg');
    });

    // TS-14: sin archivos
    it('should return empty array when prefix has no matches', async () => {
      mockS3Send = async () => ({ Contents: undefined, NextContinuationToken: undefined });
      const result = await storageService.listByPrefix('grava-gestion/empty/');
      result.should.be.an.Array().with.length(0);
    });

    // TS-15: error de red
    it('should throw error when list fails', async () => {
      mockS3Send = async () => { throw new Error('Network error'); };
      await storageService.listByPrefix('prefix/')
        .should.be.rejectedWith(/Failed to list files/);
    });
  });

  // ─── getPresignedUrl ────────────────────────────────────────────────────────

  describe('getPresignedUrl', () => {
    // TS-16: URL generada exitosamente
    it('should return signed URL string when key is valid', async () => {
      mockGetSignedUrl = async () => 'https://signed-url.example.com/file.jpg?X-Amz-Signature=abc';
      const result = await storageService.getPresignedUrl('grava-gestion/objective/1/uuid.jpg', 3600);
      result.should.be.a.String();
      result.should.startWith('https://');
    });

    // TS-17: expiresIn por defecto 60s
    it('should use default expiresIn of 60 when not specified', async () => {
      let capturedOpts: any;
      mockGetSignedUrl = async (...args: any[]) => {
        capturedOpts = args[2];
        return 'https://signed-url.example.com/file.jpg';
      };
      await storageService.getPresignedUrl('grava-gestion/objective/1/uuid.jpg');
      capturedOpts.should.have.property('expiresIn', 60);
    });

    // TS-18: error al generar
    it('should throw error when getSignedUrl fails', async () => {
      mockGetSignedUrl = async () => { throw new Error('Sign error'); };
      await storageService.getPresignedUrl('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith(/Failed to generate presigned URL/);
    });
  });

  // ─── headObject ─────────────────────────────────────────────────────────────

  describe('headObject', () => {
    // TS-19: archivo existente
    it('should return file metadata when file exists', async () => {
      const now = new Date();
      mockS3Send = async () => ({
        ContentLength: 12345,
        ContentType: 'image/jpeg',
        LastModified: now,
      });
      const result = await storageService.headObject('grava-gestion/objective/1/uuid.jpg');
      result.should.have.property('size', 12345);
      result.should.have.property('contentType', 'image/jpeg');
      result.should.have.property('lastModified', now);
    });

    // TS-20: NotFound
    it('should throw "File not found" error when NotFound is returned', async () => {
      mockS3Send = async () => {
        const err: any = new Error('NotFound');
        err.name = 'NotFound';
        throw err;
      };
      await storageService.headObject('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith(/File not found/);
    });

    // TS-21: error genérico
    it('should throw generic error when headObject fails with unknown error', async () => {
      mockS3Send = async () => {
        const err: any = new Error('Internal server error');
        err.name = 'InternalError';
        throw err;
      };
      await storageService.headObject('grava-gestion/objective/1/uuid.jpg')
        .should.be.rejectedWith(/Failed to get file metadata/);
    });
  });
});
