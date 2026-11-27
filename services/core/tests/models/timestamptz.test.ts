import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { readDb } from '../../src/models/read';
import { sequelize } from '../../src/models';
import { timestamptzToIso } from '../../src/models/timestamptz';

/**
 * `timestamptz` como ISO en la conexión de lectura: tiene que dar EXACTAMENTE lo que daba
 * `Date#toJSON()`, porque eso es lo que viaja por el bus.
 */
describe('models/timestamptz — timestamptz como ISO, sin Date', () => {
  describe('timestamptzToIso', () => {
    const cases = [
      '2026-08-07 12:50:50.66+00',
      '2026-08-07 12:50:50+00',
      '2026-08-07 12:50:50.123999+00',
      '2026-08-07 12:50:50.1+00',
      '2026-08-07 12:50:50.000001+00',
      '1999-12-31 23:59:59.999+00',
    ];
    for (const text of cases) {
      it(`${text} da lo mismo que Date#toJSON`, () => {
        timestamptzToIso(text).should.equal(new Date(text).toJSON());
      });
    }

    it('otro offset cae al camino de siempre y da lo mismo que Date', () => {
      timestamptzToIso('2026-08-07 09:50:50.66-03').should.equal('2026-08-07T12:50:50.660Z');
    });

    it('infinity y -infinity se devuelven como los devolvía Sequelize', () => {
      timestamptzToIso('infinity').should.equal(Infinity);
      timestamptzToIso('-infinity').should.equal(-Infinity);
    });
  });

  describe('contra la base', () => {
    const SQL = `SELECT t AS "at", t::date AS "day", NULL::timestamptz AS "nothing"
                   FROM (VALUES ('2026-08-07 12:50:50.123456+00'::timestamptz)) v(t)`;

    it('la conexión de LECTURA devuelve el ISO como string', async () => {
      const [row] = await readDb.query<Record<string, unknown>>(SQL, { type: QueryTypes.SELECT });
      row.at!.should.equal('2026-08-07T12:50:50.123Z');
      (row.nothing === null).should.be.true();
    });

    it('la serialización es la misma que con el Date de la conexión de escritura', async () => {
      const [read] = await readDb.query<Record<string, unknown>>(SQL, { type: QueryTypes.SELECT });
      const [write] = await sequelize.query<Record<string, unknown>>(SQL, {
        type: QueryTypes.SELECT,
      });
      (write.at instanceof Date).should.be.true();
      JSON.stringify(read).should.equal(JSON.stringify(write));
    });
  });
});
