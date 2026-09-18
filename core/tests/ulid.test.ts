import 'mocha';
import 'should';
import { generateUlid } from '../src/ulid';

describe('ulid — el generador de S-063', () => {
  it('TS-11 · tiene 26 caracteres del alfabeto Crockford base32', () => {
    const id = generateUlid();

    id.length.should.equal(26);
    id.should.match(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('TS-12 · 1000 generaciones son únicas y lexicográficamente ordenables en el tiempo', () => {
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) {
      ids.push(generateUlid());
    }

    // Únicos.
    new Set(ids).size.should.equal(1000);

    // El prefijo de tiempo (los primeros 10 caracteres) es monótono no decreciente: como todos
    // se generan en un lapso brevísimo, la mayoría caen en el mismo milisegundo y el prefijo se
    // repite — lo que no puede pasar es que RETROCEDA.
    let previous = ids[0].slice(0, 10);
    for (const id of ids) {
      const prefix = id.slice(0, 10);
      (prefix >= previous).should.be.true();
      previous = prefix;
    }
  });

  it('dos ULIDs generados en el MISMO milisegundo son distintos', () => {
    const now = Date.now();
    const a = generateUlid(now);
    const b = generateUlid(now);

    a.should.not.equal(b);
    // El prefijo de tiempo (primeros 10 caracteres) sí coincide: es la misma marca de tiempo.
    a.slice(0, 10).should.equal(b.slice(0, 10));
  });

  it('el prefijo de tiempo crece con el timestamp', () => {
    const early = generateUlid(1_700_000_000_000);
    const late = generateUlid(1_800_000_000_000);

    (late.slice(0, 10) > early.slice(0, 10)).should.be.true();
  });
});
