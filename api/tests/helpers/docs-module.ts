import 'should';
import { Application } from 'express';
import request from 'supertest';
import { Reply } from '../../lib/utils/bus/protocol';
import { docsModule } from '../../lib/modules/registry';
import { fakeBus } from '../mocks/bus';

export const DOCS_RECORD = {
  module: 'docs',
  serviceName: 'jiku-docs',
  protocol: 'v1',
  registeredAt: '2026-10-24T12:00:00.000Z',
};

export const DOC_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V2W';
export const FOLDER_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V2X';
export const ATT_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V2Y';
export const SESSION_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V2Z';
export const SHARE_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V30';
export const FOLDER2_ID = '01JB2Z3K4M5N6P7Q8R9S0T1V31';

export const QUERY_SUBJECT_PREFIX = 'dev.000000000000000001.jiku-docs-queries.v1.';
export const COMMAND_SUBJECT_PREFIX = 'dev.000000000000000001.jiku-docs-commands.v1.';

/** Módulo `available`: registro asentado + ping que responde. */
export async function docsAvailable(): Promise<void> {
  await fakeBus.kvPut('docs', DOCS_RECORD);
  fakeBus.pingResponds('jiku-docs', true);
  await docsModule.start();
}

/** Módulo `unavailable`: registro asentado, ping sin respuesta. */
export async function docsUnavailable(): Promise<void> {
  await fakeBus.kvPut('docs', DOCS_RECORD);
  fakeBus.pingResponds('jiku-docs', false);
  await docsModule.start();
}

/** Módulo `not_installed`: sin clave en el KV. */
export async function docsNotInstalled(): Promise<void> {
  await docsModule.start();
}

export function success<T>(data: T): Reply<T> {
  return { status: 'success', data } as Reply<T>;
}

export function failure(errorCode: string, errorMessage: string, errorDetails?: Record<string, unknown>): Reply {
  const reply: any = { status: 'failure', errorCode, errorMessage };
  if (errorDetails) reply.errorDetails = errorDetails;
  return reply as Reply;
}

/**
 * TS-45: una ruta respeta el estado del módulo. `not_installed` -> 404, `unavailable` -> 503,
 * en ambos casos sin llamar al módulo. Se invoca dentro de un `describe` del archivo de ruta.
 */
export function itRespectsModuleState(
  getApp: () => Application,
  url: string,
  token: string,
  title = 'S-078 · TS-45: respeta el estado del módulo',
  options: { method?: 'get' | 'post' | 'put' | 'delete'; body?: object } = {}
) {
  it(title, async () => {
    const hit = () => {
      const call = request(getApp())[options.method ?? 'get'](url).set('Authorization', `Bearer ${token}`);
      return options.body ? call.send(options.body) : call;
    };

    await docsNotInstalled();
    const a = await hit();
    a.status.should.equal(404);
    a.body.should.deepEqual({ code: 'module_not_installed', message: 'El módulo docs no está instalado' });
    fakeBus.moduleSent.length.should.equal(0);

    docsModule.stop();
    await docsUnavailable();
    const b = await hit();
    b.status.should.equal(503);
    b.body.should.deepEqual({
      code: 'module_unavailable',
      message: 'El módulo docs no está disponible en este momento',
    });
    fakeBus.moduleSent.length.should.equal(0);
  });
}
