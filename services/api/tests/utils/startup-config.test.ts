import 'mocha';
import 'should';
import { spawnSync } from 'child_process';
import path from 'path';

const API_ROOT = path.join(__dirname, '..', '..');

/**
 * Starts the real entry point (`bin/index.ts`) with the test environment minus some variables and
 * returns how it ended. The configuration asserts run before the database, so a refused start
 * ends in a few seconds without touching anything.
 */
function startApi(without: string[], extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra, TS_NODE_TRANSPILE_ONLY: 'true' };
  for (const name of without) delete env[name];
  return spawnSync(process.execPath, ['-r', 'ts-node/register', 'bin/index.ts'], {
    cwd: API_ROOT,
    env,
    encoding: 'utf8',
    timeout: 60000,
  });
}

describe('api startup configuration (#626)', function () {
  this.timeout(120000);

  it('[ACC-E7] does not start without the expected issuer, and the error names IDENTITY_ISSUER', () => {
    const run = startApi(['IDENTITY_ISSUER']);
    (run.status as number).should.equal(1);
    `${run.stderr}${run.stdout}`.should.match(/Falta IDENTITY_ISSUER/);
  });

  it('[ACC-E7] does not start with a blank expected issuer', () => {
    const run = startApi([], { IDENTITY_ISSUER: '   ' });
    (run.status as number).should.equal(1);
    `${run.stderr}${run.stdout}`.should.match(/Falta IDENTITY_ISSUER/);
  });

  it('[ACC-E7] does not start without the project id, and the error names ZITADEL_PROJECT_ID', () => {
    const run = startApi(['ZITADEL_PROJECT_ID']);
    (run.status as number).should.equal(1);
    `${run.stderr}${run.stdout}`.should.match(/Falta ZITADEL_PROJECT_ID/);
  });
});
