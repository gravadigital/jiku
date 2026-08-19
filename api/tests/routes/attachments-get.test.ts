import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Objective, Project, User, UserProjectPermission } from '@jiku/models';

// Tokens del mock:
// token_01_user          → sub: zitadel-sub-01, rol: user
// token_04_external_user → sub: zitadel-sub-04, rol: external-user

/**
 * El fixture cambió de forma con S-005: los campos del archivo viven en `files` y el vínculo
 * los referencia por `file_id`. Las columnas homónimas de `attachments` siguen siendo
 * `allowNull: false` en el modelo compartido, así que se pueblan igual — y esa duplicación
 * es justo lo que permite probar que la lectura sale del `include` y no de la columna vieja.
 */
async function createFile(overrides: Record<string, any> = {}): Promise<File> {
  return File.create({
    fileName: 'file.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    storageKey: `grava-gestion/f/${Math.random()}.pdf`,
    storageBucket: 'test-bucket',
    storageRegion: 'sfo2',
    byteStatus: 'uploaded',
    retentionStatus: 'active',
    uploadedBy: 'zitadel-sub-01',
    ...overrides,
  } as any, { validate: false });
}

async function createAttachment(
  fileOverrides: Record<string, any> = {},
  attachmentOverrides: Record<string, any> = {}
): Promise<Attachment> {
  const file = await createFile(fileOverrides);
  return Attachment.create({
    entityType: 'objective',
    entityId: 1,
    fileId: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    storageKey: file.storageKey,
    storageBucket: file.storageBucket,
    storageRegion: file.storageRegion,
    uploadedBy: file.uploadedBy,
    ...attachmentOverrides,
  } as any, { validate: false });
}

describe('GET /api/attachments', () => {
  let application: Application;

  before(function() {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 2, title: 'Objective 2 Empty', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      // 3 attachments activos con fechas distintas
      .then(() => createAttachment({ fileName: 'oldest.pdf' }, { createdAt: new Date('2026-01-01') }))
      .then(() => createAttachment({ fileName: 'middle.pdf' }, { createdAt: new Date('2026-01-15') }))
      .then(() => createAttachment({ fileName: 'newest.pdf' }, { createdAt: new Date('2026-02-01') }))
      // 2 attachments soft-deleted
      .then(() => createAttachment({ fileName: 'deleted1.pdf' }, { deletedAt: new Date(), deletedBy: 'zitadel-sub-01' }))
      .then(() => createAttachment({ fileName: 'deleted2.pdf' }, { deletedAt: new Date(), deletedBy: 'zitadel-sub-01' }));
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-4: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-7: Sin entityType
  it('should return 400 when entityType is missing', () => {
    return request(application)
      .get('/api/attachments?entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_query');
        res.body.message.should.equal('entityType and entityId are required');
      });
  });

  // TS-8: Sin entityId
  it('should return 400 when entityId is missing', () => {
    return request(application)
      .get('/api/attachments?entityType=objective')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_query');
      });
  });

  // TS-5: entityType inválido
  it('should return 400 with invalid entityType', () => {
    return request(application)
      .get('/api/attachments?entityType=xxx&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_type');
      });
  });

  // TS-6: entityId no numérico
  it('should return 400 when entityId is not numeric', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_entity_id');
        res.body.message.should.equal('entityId must be a valid integer');
      });
  });

  // TS-9: Usuario externo sin permisos
  it('should return 403 for external user without permission', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-1: Listado exitoso con uploader
  it('should return 200 with active attachments including uploader', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array();
        res.body[0].should.have.properties([
          'id', 'entityType', 'entityId', 'fileName', 'fileSize',
          'mimeType', 'storageKey', 'uploadedBy', 'createdAt', 'uploader'
        ]);
        res.body[0].uploader.should.have.properties(['id', 'name', 'email']);
        res.body[0].uploader.id.should.equal('zitadel-sub-01');
      });
  });

  // TS-2: Solo attachments activos (excluye soft-deleted)
  it('should return only active attachments (excluding soft-deleted)', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        // 5 attachments created: 3 active + 2 soft-deleted → only 3 returned. Que el scope
        // filtre los borrados se prueba por la cantidad: la respuesta aplanada no expone
        // `deletedAt`, y nunca lo declaró el contrato.
        res.body.should.be.an.Array().with.length(3);
      });
  });

  // TS-3: Ordenamiento DESC por createdAt
  it('should return attachments ordered by createdAt DESC', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array().with.length(3);
        const dates = res.body.map((a: any) => new Date(a.createdAt).getTime());
        dates[0].should.be.aboveOrEqual(dates[1]);
        dates[1].should.be.aboveOrEqual(dates[2]);
        res.body[0].fileName.should.equal('newest.pdf');
        res.body[2].fileName.should.equal('oldest.pdf');
      });
  });

  // TS-10: Usuario interno siempre tiene acceso
  it('should allow internal user without checking UserProjectPermission', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200);
  });

  // TS-26: los campos del archivo salen del `include` a `files`, aplanados.
  it('arma los campos del archivo desde el include, con la respuesta aplanada', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        const item = res.body[0];
        item.should.have.properties([
          'id', 'entityType', 'entityId', 'fileId', 'fileName', 'fileSize', 'mimeType',
          'storageKey', 'storageBucket', 'storageRegion', 'uploadedBy', 'byteStatus',
          'createdAt', 'uploader'
        ]);
        item.byteStatus.should.equal('uploaded');
        item.uploadedBy.should.equal('zitadel-sub-01');
        item.fileId.should.be.a.Number();
        // Aplanada: NO hay objeto `file` anidado. El contrato con los frontends no cambia.
        item.should.not.have.property('file');
      });
  });

  // TS-11: Entidad sin attachments (usando objetivo existente del que el usuario es creador)
  it('should return empty array for entity without attachments', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=2')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array().with.length(0);
      });
  });
});

describe('GET /api/attachments/:id', () => {
  let application: Application;
  let activeAttachmentId: number;
  let deletedAttachmentId: number;
  let divergentAttachmentId: number;
  let divergentUploaderAttachmentId: number;
  let contractAttachmentId: number;

  before(function() {
    this.timeout(30000);
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'u1@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser', email: 'ext@mail.com' }))
      .then(() => Project.create({
        id: 1, code: 'P1', name: 'Project 1', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01'
      }))
      .then(() => Objective.create({
        id: 1, title: 'Objective 1', state: 'activo', area: 'desarrollo',
        priority: 1, projectId: 1, createdBy: 'zitadel-sub-01'
      }))
      .then(() => createAttachment({ fileName: 'active-file.pdf', fileSize: 2048 }))
      .then((a: Attachment) => { activeAttachmentId = a.id; })
      .then(() => createAttachment(
        { fileName: 'deleted-file.pdf' },
        { deletedAt: new Date(), deletedBy: 'zitadel-sub-01' }
      ))
      .then((a: Attachment) => { deletedAttachmentId = a.id; })
      // TS-28: divergencia deliberada entre la columna vieja del vínculo y la fila de `files`.
      // Es lo ÚNICO que distingue "lee del include" de "lee de la columna vieja y casualmente
      // coinciden".
      .then(() => createAttachment(
        { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 4194304 },
        { fileName: 'VIEJO.txt', mimeType: 'text/plain', fileSize: 1 }
      ))
      .then((a: Attachment) => { divergentAttachmentId = a.id; })
      // El vínculo dice `zitadel-sub-01` y el archivo `zitadel-sub-04`: si `uploader` se
      // resolviera desde `attachments.uploaded_by`, `uploadedBy` y `uploader` describirían a
      // dos personas distintas.
      .then(() => createAttachment(
        { fileName: 'de-otro.pdf', uploadedBy: 'zitadel-sub-04' },
        { uploadedBy: 'zitadel-sub-01' }
      ))
      .then((a: Attachment) => { divergentUploaderAttachmentId = a.id; })
      // Fixture del contrato aplanado (TS-45 / TS-46). Los valores son los del Story Plan,
      // verbatim: son los que las dos aserciones comparan campo por campo.
      .then(() => createAttachment({
        fileName: 'doc.pdf', fileSize: 1024, mimeType: 'application/pdf', byteStatus: 'uploaded',
      }))
      .then((a: Attachment) => { contractAttachmentId = a.id; });
  });

  after(() => {
    return Attachment.destroy({ where: {}, force: true })
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Objective.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-17: Sin token
  it('should return 401 without token', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .expect(401)
      .then(res => {
        res.body.code.should.equal('unauthorized');
      });
  });

  // TS-18: ID no numérico
  it('should return 400 when id is not numeric', () => {
    return request(application)
      .get('/api/attachments/abc')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then(res => {
        res.body.code.should.equal('invalid_id');
        res.body.message.should.equal('Attachment ID must be a valid integer');
      });
  });

  // TS-14: Attachment inexistente
  it('should return 404 for non-existent attachment', () => {
    return request(application)
      .get('/api/attachments/9999')
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
        res.body.message.should.equal('Attachment not found');
      });
  });

  // TS-15: Attachment soft-deleted → 404
  it('should return 404 for soft-deleted attachment', () => {
    return request(application)
      .get(`/api/attachments/${deletedAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(404)
      .then(res => {
        res.body.code.should.equal('not_found');
      });
  });

  // TS-16: Usuario externo sin permisos
  it('should return 403 for external user without permission on entity', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then(res => {
        res.body.code.should.equal('access_denied');
      });
  });

  // TS-12: Detalle exitoso con uploader
  it('should return 200 with full attachment details including uploader', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.have.properties([
          'id', 'entityType', 'entityId', 'fileName', 'fileSize',
          'mimeType', 'storageKey', 'storageBucket', 'storageRegion',
          'uploadedBy', 'retentionStatus', 'createdAt', 'updatedAt', 'uploader'
        ]);
        res.body.id.should.equal(activeAttachmentId);
        res.body.fileName.should.equal('active-file.pdf');
        res.body.uploader.should.have.properties(['id', 'name', 'email']);
        res.body.uploader.id.should.equal('zitadel-sub-01');
      });
  });

  // TS-27: el detalle arma los campos del archivo igual, con `id` = id del VÍNCULO.
  it('arma el detalle desde el include, conservando el id del vínculo', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.id.should.equal(activeAttachmentId);
        res.body.fileId.should.be.a.Number();
        res.body.fileSize.should.equal(2048);
        res.body.byteStatus.should.equal('uploaded');
        res.body.should.not.have.property('file');
      });
  });

  // TS-28: LA PRUEBA QUE IMPORTA. Con `attachments.file_name = 'VIEJO.txt'` y
  // `files.file_name = 'informe.pdf'`, la respuesta trae el valor de `files`.
  it('lee los metadatos de files, no de las columnas viejas de attachments', () => {
    return request(application)
      .get(`/api/attachments/${divergentAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.fileName.should.equal('informe.pdf');
        res.body.mimeType.should.equal('application/pdf');
        res.body.fileSize.should.equal(4194304);
      });
  });

  // `uploader` sale del ARCHIVO, no del vínculo (Task 6, AC-6). Sin este test la
  // divergencia pasa inadvertida: los demás fixtures ponen el mismo `uploaded_by` en las dos
  // tablas y los dos orígenes coinciden por casualidad.
  it('resuelve el uploader desde files, no desde la columna del vínculo', () => {
    return request(application)
      .get(`/api/attachments/${divergentUploaderAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.uploadedBy.should.equal('zitadel-sub-04');
        res.body.uploader.id.should.equal('zitadel-sub-04');
        // Los dos campos describen SIEMPRE a la misma persona.
        res.body.uploader.id.should.equal(res.body.uploadedBy);
      });
  });

  // TS-13: No incluye checksum
  it('should not include checksum field in response', () => {
    return request(application)
      .get(`/api/attachments/${activeAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.not.have.property('checksum');
      });
  });
  /**
   * TS-45 (CA-11): ANTI-REGRESIÓN, no implementación. El aplanado lo hizo S-005; esta story
   * solo lo blinda, porque es exactamente el tipo de criterio que se rompe sin que nadie lo
   * note: los tipos de `web` y `opus-web` están ESCRITOS A MANO y NO fallan en compilación si
   * divergen, así que una regresión de forma aparecería en runtime, en el navegador de un
   * usuario.
   */
  it('conserva los campos del archivo aplanados, con fileId y byteStatus y sin checksum', () => {
    return request(application)
      .get(`/api/attachments/${contractAttachmentId}`)
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        // Campos propios del VÍNCULO.
        res.body.should.have.property('id', contractAttachmentId);
        res.body.should.have.property('entityType', 'objective');
        res.body.should.have.property('entityId', 1);
        res.body.should.have.property('createdAt');

        // La FK al archivo, que S-005 agregó al contrato.
        res.body.should.have.property('fileId').which.is.a.Number();

        // Los campos del archivo, aplanados sobre el vínculo.
        res.body.should.have.property('fileName', 'doc.pdf');
        res.body.should.have.property('fileSize', 1024);
        res.body.should.have.property('mimeType', 'application/pdf');
        res.body.should.have.property('storageKey');
        res.body.should.have.property('storageBucket');
        res.body.should.have.property('storageRegion');
        res.body.should.have.property('uploadedBy');

        // El estado del byte, que NO existe como columna en `attachments`.
        res.body.should.have.property('byteStatus', 'uploaded');

        // `checksum` sigue fuera de la respuesta.
        res.body.should.not.have.property('checksum');
      });
  });

  // TS-46 (CA-11): el listado conserva la MISMA forma que el detalle. Sin este caso, una
  // regresión que aplanara solo en `getAttachmentById` pasaría inadvertida.
  it('conserva la forma aplanada también en el listado', () => {
    return request(application)
      .get('/api/attachments?entityType=objective&entityId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then(res => {
        res.body.should.be.an.Array().and.not.be.empty();
        res.body.forEach((item: any) => {
          item.should.have.property('fileId');
          item.should.have.property('byteStatus');
          item.should.have.property('fileName');
          item.should.have.property('fileSize');
          item.should.have.property('mimeType');
          item.should.have.property('storageKey');
          item.should.have.property('storageBucket');
          item.should.have.property('storageRegion');
          item.should.have.property('uploadedBy');
          item.should.not.have.property('checksum');
        });
      });
  });
});
