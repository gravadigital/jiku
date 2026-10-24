import 'mocha';
import 'should';
import { DOCS_STATUS_BY_ERROR_CODE, docsErrorBody, docsHttpStatusFor } from '../../lib/modules/docs/errors';
import { errorBody, httpStatusFor } from '../../lib/utils/bus/protocol';

describe('S-077 · mapa de errores de docs', () => {
  it('S-077 · TS-40: tabla completa de los 30 códigos', () => {
    const table: Record<number, string[]> = {
      400: ['invalid_fields', 'invalid_cursor', 'file_name_invalid', 'frontmatter_invalid', 'invalid_relation',
        'content_too_large', 'checksum_mismatch', 'upload_not_found', 'attachment_type_not_allowed',
        'attachment_too_large', 'share_expiry_invalid', 'secret_warning_not_acknowledged',
        'semantic_search_not_configured'],
      403: ['permission_denied', 'sharing_blocked', 'unknown_caller', 'caller_not_authorized'],
      404: ['document_not_found', 'folder_not_found', 'attachment_not_found', 'share_not_found'],
      409: ['version_conflict', 'document_locked', 'lock_not_held', 'already_exists', 'folder_not_empty'],
      503: ['upstream_unavailable', 'attachments_not_configured'],
      504: ['query_timeout'],
      500: ['internal_error'],
    };
    let count = 0;
    Object.keys(table).forEach((status) => {
      table[Number(status)].forEach((code) => {
        docsHttpStatusFor(code).should.equal(Number(status), code);
        count += 1;
      });
    });
    count.should.equal(30);
    docsHttpStatusFor(undefined).should.equal(500);
    Object.keys(DOCS_STATUS_BY_ERROR_CODE).length.should.equal(30);
  });

  it('S-077 · TS-41: no se mezcla con el mapa de core', () => {
    docsHttpStatusFor('access_denied').should.equal(500);
    httpStatusFor('caller_not_authorized').should.equal(403);
    errorBody({ status: 'failure', errorCode: 'x', errorMessage: 'm', errorDetails: { a: 1 } } as any)
      .should.deepEqual({ code: 'x', message: 'm' });
  });

  it('S-077 · TS-42: defaults del cuerpo', () => {
    docsErrorBody({ status: 'failure' } as any).should.deepEqual({ code: 'internal_error', message: 'Internal error' });
  });
});
