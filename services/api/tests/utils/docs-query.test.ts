import 'mocha';
import 'should';
import { buildDocumentsFilter } from '../../lib/modules/docs/query';

describe('S-094 · buildDocumentsFilter', () => {
  it('S-094 · TS-60: traduce solo las claves presentes y arma `or` para person', () => {
    buildDocumentsFilter({
      projectId: [12], clientId: [4], topic: ['a'], hasProject: false, person: ['s1'], visibility: 'public',
      folderId: '01JB2Z3K4M5N6P7Q8R9S0T1V2X', pathPrefix: '/x/', requirementId: 7, taskId: 9,
      sort: '-updatedAt', limit: 50, cursor: 'c', count: true, myActiveProjects: false, q: 'x',
    }).should.deepEqual({
      projectId: [12], clientId: [4], topic: ['a'], hasProject: false, visibility: 'public',
      folderId: '01JB2Z3K4M5N6P7Q8R9S0T1V2X', pathPrefix: '/x/', requirementId: 7, taskId: 9,
      or: [{ createdBy: ['s1'] }, { updatedBy: ['s1'] }],
    });
  });

  it('S-094 · TS-60: vacío y person vacío no agregan claves', () => {
    buildDocumentsFilter({}).should.deepEqual({});
    buildDocumentsFilter({ person: [] }).should.deepEqual({});
  });
});
