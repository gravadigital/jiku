import 'mocha';
import 'should';
import sinon from 'sinon';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SystemSetting } from '@jiku/models';
import { readDb } from '../../src/models/read';
import { SETTINGS_WHITELIST, settingsSpec } from '../../src/queries/settings/settings-spec';
import { dispatchQuery } from '../helpers/dispatch';
import {
  Q_EXTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';

/**
 * `settings.list` — LA LISTA BLANCA DE CLAVES (S-028, Task 3).
 *
 * Lo que estos tests fijan no es "devuelve seis filas": es que la lista blanca es CERRADA y se
 * aplica ANTES del filtro. Una clave real de `system_settings` que no esté declarada no aparece ni
 * sin filtro ni pidiéndola por su nombre, y no aparece como error sino como colección VACÍA.
 */

/** La clave que EXISTE EN LA TABLA y NO está en el contrato. Es el centro de CA-8 y CA-9. */
const UNDECLARED_KEY = 'clave-de-experimento';

/** Las seis, EN NOMBRES DEL CONTRATO. `hours-per-day` con guiones MEDIOS (H-1). */
const CONTRACT_KEYS = [
  'download-url-ttl-seconds',
  'file-allowed-extensions',
  'file-allowed-mime-types',
  'file-max-size-bytes',
  'hours-per-day',
  'upload-url-ttl-seconds',
];

interface Setting {
  id: number;
  key: string;
  value: string;
}

function items(reply: any): Setting[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data.items as Setting[];
}

function keys(reply: any): string[] {
  return items(reply).map((item) => item.key);
}

describe('queries/settings.list — la lista blanca de claves (S-028, Task 3)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();

    await SystemSetting.bulkCreate([
      // ⚠️ CON GUIONES BAJOS, que es como la clave existe en la base desde febrero (H-1). El
      // contrato la publica con guiones medios y la ficha traduce.
      { key: 'hours_per_day', value: '6' },
      { key: 'upload-url-ttl-seconds', value: '900' },
      { key: 'download-url-ttl-seconds', value: '300' },
      { key: 'file-max-size-bytes', value: '10485760' },
      { key: 'file-allowed-extensions', value: 'pdf,png,jpg' },
      { key: 'file-allowed-mime-types', value: 'application/pdf,image/png,image/jpeg' },
      // LA CLAVE REAL FUERA DEL CONTRATO: existe en la tabla y no existe para esta API.
      { key: UNDECLARED_KEY, value: 'x' },
    ] as any);
  });

  after(async () => {
    await SystemSetting.destroy({ where: {} });
    await destroyQueryCallers();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  /* ------------------------------------------------------------------------------------------
   * LA LISTA BLANCA
   * ---------------------------------------------------------------------------------------- */

  it('TS-31 · devuelve las SEIS claves del contrato, con `value` siempre string (CA-7, CA-8)', async () => {
    const reply = await dispatchQuery('settings.list', {});

    keys(reply).should.deepEqual(CONTRACT_KEYS);
    items(reply).should.matchEach((item: Setting) => {
      (typeof item.value).should.equal('string');
      Object.keys(item).should.deepEqual(['id', 'key', 'value']);
    });
  });

  it('TS-32 · ⚠️ H-1: `hours-per-day` aparece aunque la columna diga `hours_per_day` (CA-8)', async () => {
    const reply = await dispatchQuery('settings.list', {});

    items(reply)
      .find((item) => item.key === 'hours-per-day')!
      .value.should.equal('6');
    // Y el nombre de la COLUMNA no se filtra al contrato.
    JSON.stringify(reply).should.not.containEql('hours_per_day');
  });

  it('TS-33 · una clave fuera de la lista blanca NO aparece sin filtro (CA-8)', async () => {
    const reply = await dispatchQuery('settings.list', {});

    keys(reply).should.not.containEql(UNDECLARED_KEY);
    items(reply).should.have.length(6);
  });

  it('TS-34 · pedida EXPLÍCITAMENTE devuelve `items: []`, NO un error (CA-9)', async () => {
    const reply: any = await dispatchQuery('settings.list', { filter: { key: UNDECLARED_KEY } });

    // La diferencia importa: un `invalid_fields` diría "ese nombre es inválido"; la colección vacía
    // dice "no existe para esta API". La segunda es la verdad.
    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
  });

  it('TS-35 · el filtro se combina con AND contra la lista blanca (CA-8, CA-9)', async () => {
    const reply = await dispatchQuery('settings.list', { filter: { key: 'file-max-size-bytes' } });

    items(reply).should.have.length(1);
    items(reply)[0].key.should.equal('file-max-size-bytes');
  });

  it('la clave TRADUCIDA se puede pedir por su nombre del contrato (H-1)', async () => {
    const reply = await dispatchQuery('settings.list', { filter: { key: 'hours-per-day' } });

    items(reply).should.have.length(1);
    items(reply)[0].key.should.equal('hours-per-day');
    items(reply)[0].value.should.equal('6');
  });

  it('pedirla por su nombre de COLUMNA devuelve la misma fila, bajo su nombre del contrato', () => {
    // CONSECUENCIA CONOCIDA Y ACEPTADA de resolver H-1 con `FilterableSpec.values`: un valor que NO
    // está en el mapa viaja tal cual, así que `hours_per_day` matchea la columna. La fila vuelve
    // igual bajo su nombre del contrato, así que el alias no da acceso a nada no declarado ni filtra
    // el esquema en la RESPUESTA.
    //
    // LA ALTERNATIVA SE DESCARTÓ: para que el nombre de columna no matcheara habría que mapearlo a
    // un valor imposible, o sea meter un truco en la ficha para cerrar un alias que no abre nada.
    // El precio de cerrarlo es mayor que el de documentarlo.
    return dispatchQuery('settings.list', { filter: { key: 'hours_per_day' } }).then((reply: any) => {
      reply.status.should.equal('success');
      reply.data.items.should.have.length(1);
      reply.data.items[0].key.should.equal('hours-per-day');
    });
  });

  it('una clave heredada de `Object.prototype` no rompe la consulta', async () => {
    // El valor del filtro viene DEL PAYLOAD, así que una indexación directa sobre el mapa de
    // traducción resolvería `constructor` o `__proto__` contra `Object.prototype` y devolvería una
    // función. El caller recibiría un 500 por haber escrito una palabra.
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const reply: any = await dispatchQuery('settings.list', { filter: { key } });

      reply.status.should.equal('success', `${key}: ${JSON.stringify(reply)}`);
      reply.data.items.should.deepEqual([], key);
      (reply.errorCode === undefined).should.be.true(key);
    }
  });

  it('TS-44 · una clave de la lista blanca AUSENTE en la base simplemente no aparece (CA-8)', async () => {
    await SystemSetting.destroy({ where: { key: 'upload-url-ttl-seconds' } });

    try {
      const reply = await dispatchQuery('settings.list', {});

      items(reply).should.have.length(5);
      keys(reply).should.not.containEql('upload-url-ttl-seconds');
    } finally {
      await SystemSetting.create({ key: 'upload-url-ttl-seconds', value: '900' } as any);
    }
  });

  it('TS-45 · `count: true` cuenta lo mismo que la colección devuelve (CA-7)', async () => {
    const reply: any = await dispatchQuery('settings.list', { count: true });

    // El `where` de la ficha se emite también en el COUNT: sin eso, el total contaría la clave de
    // experimento que la colección no devuelve.
    reply.data.page.total.should.equal(6);
    reply.data.items.should.have.length(6);
  });

  /* ------------------------------------------------------------------------------------------
   * SIN ACCESO EXTERNO
   * ---------------------------------------------------------------------------------------- */

  it('TS-36 · un caller externo recibe `items: []` con CERO SQL (CA-7)', async () => {
    const spy = sinon.spy(readDb, 'query');

    const reply: any = await dispatchQuery('settings.list', {}, Q_EXTERNAL);

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
    reply.data.page.limit.should.equal(50);
    reply.data.page.returned.should.equal(0);
    // NINGUNA consulta llega a `readDb`. Un `WHERE FALSE` daría el mismo resultado y pagaría un
    // round-trip por cada request de un portal que no tiene por qué leer nada.
    spy.called.should.be.false();
  });

  it('TS-37 · el corte externo va ANTES del filtro (CA-7)', async () => {
    const spy = sinon.spy(readDb, 'query');

    const reply: any = await dispatchQuery(
      'settings.list',
      { filter: { key: 'hours-per-day' } },
      Q_EXTERNAL
    );

    reply.data.items.should.deepEqual([]);
    spy.called.should.be.false();
  });

  /* ------------------------------------------------------------------------------------------
   * LA GRAMÁTICA
   * ---------------------------------------------------------------------------------------- */

  it('TS-38 · el orden por defecto es ascendente por `key` (CA-7)', async () => {
    const reply = await dispatchQuery('settings.list', {});

    keys(reply).should.deepEqual([...keys(reply)].sort());
  });

  it('TS-39 · `sort: ["-key"]` invierte el orden (CA-7)', async () => {
    const reply = await dispatchQuery('settings.list', { sort: ['-key'] });

    keys(reply).should.deepEqual([...CONTRACT_KEYS].reverse());
  });

  it('TS-40 · un `sort` por un nombre no declarado es `invalid_fields` (CA-7, CA-20)', async () => {
    const reply: any = await dispatchQuery('settings.list', { sort: ['value'] });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual(['key', 'id']);
  });

  it('TS-41 · `include` no declara NINGUNO (CA-7, CA-20)', async () => {
    const reply: any = await dispatchQuery('settings.list', { include: ['value'] });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual([]);
  });

  it('TS-42 · un `filter` por un nombre no declarado es `invalid_fields` (CA-7, CA-20)', async () => {
    const reply: any = await dispatchQuery('settings.list', { filter: { value: '6' } });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual(['key']);
  });

  it('TS-43 · `value` es string incluso cuando el contenido es numérico (CA-7)', async () => {
    const reply = await dispatchQuery('settings.list', { filter: { key: 'hours-per-day' } });

    const value = items(reply)[0].value;
    (typeof value).should.equal('string');
    value.should.equal('6');
    (value as unknown as object).should.not.equal(6);
  });

  it('TS-46 · NO devuelve ningún `*_not_found` (CA-20)', async () => {
    const reply: any = await dispatchQuery('settings.list', { filter: { key: 'no-existe' } });

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
    JSON.stringify(reply).should.not.containEql('_not_found');
  });

  it('TS-47 · `settings.get` NO existe (CA-20)', async () => {
    const reply: any = await dispatchQuery('settings.get', { id: 1 });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('unknown_command');
    reply.errorMessage.should.containEql('settings.get');
  });
});

/**
 * LA FORMA DE LA FICHA (TS-48): lo que se verifica sin base.
 */
describe('queries/settings — la ficha (S-028, Task 3, TS-48)', () => {
  it('la lista blanca tiene SEIS entradas y son las del contrato', () => {
    SETTINGS_WHITELIST.should.deepEqual([
      'hours-per-day',
      'upload-url-ttl-seconds',
      'download-url-ttl-seconds',
      'file-max-size-bytes',
      'file-allowed-extensions',
      'file-allowed-mime-types',
    ]);
  });

  it('la ficha NO importa `SETTING_KEYS` del plano de comandos', () => {
    // `SETTING_KEYS` vive en `commands/files/settings.ts` y es la política de ESCRITURA. Que
    // coincidan en cinco de seis entradas es correcto: son dos contratos distintos que hoy nombran
    // lo mismo, y el día que uno cambie el otro no tiene por qué seguirlo.
    // Sobre el CÓDIGO, no sobre el texto crudo: el comentario de la ficha nombra `SETTING_KEYS` para
    // explicar por qué NO lo importa, y eso es documentación, no una dependencia.
    const code = readFileSync(
      join(__dirname, '..', '..', 'src', 'queries', 'settings', 'settings-spec.ts'),
      'utf8'
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    code.should.not.containEql("from '../../commands");
    code.should.not.containEql('SETTING_KEYS');
  });

  it('la lista blanca es el `where` de la ficha, no un filtro', () => {
    // Un filtro se pisa desde el payload; el predicado del recurso no es negociable.
    settingsSpec.where!.should.containEql('t.key IN (');
    settingsSpec.where!.should.containEql("'hours_per_day'");
    Object.keys(settingsSpec.filterable).should.deepEqual(['key']);
  });

  it('declara recorte externo `none` y ningún incluible', () => {
    settingsSpec.externalScope.kind.should.equal('none');
    settingsSpec.includableNames.should.deepEqual([]);
    settingsSpec.defaults.sort.should.deepEqual(['key']);
    (settingsSpec.notFoundCode === undefined).should.be.true();
  });
});
