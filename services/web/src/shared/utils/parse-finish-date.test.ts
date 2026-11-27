import { describe, it, expect } from 'vitest';
import { parseFinishDate } from './parse-finish-date';

const local = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe('parseFinishDate', () => {
  it('TS-1: null devuelve null', () => expect(parseFinishDate(null)).toBeNull());
  it('TS-2: undefined devuelve null', () => expect(parseFinishDate(undefined)).toBeNull());
  it('TS-3: vacío devuelve null', () => expect(parseFinishDate('')).toBeNull());
  it('TS-4: texto no fecha devuelve null', () => expect(parseFinishDate('abc')).toBeNull());
  it('TS-5: DD/MM/AAAA devuelve null', () => expect(parseFinishDate('31/12/2026')).toBeNull());
  it('TS-6: MM/DD/AAAA devuelve null', () => expect(parseFinishDate('12/31/2026')).toBeNull());
  it('TS-7: Date inválido devuelve null', () =>
    expect(parseFinishDate(new Date('invalid'))).toBeNull());

  it('TS-8: YYYY-MM-DD se construye como fecha local', () => {
    const d = parseFinishDate('2026-10-23');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(23);
    expect(d?.getHours()).toBe(0);
    expect(d?.getTime()).toBe(local(2026, 9, 23));
  });

  it('TS-9: ISO con hora toma el día escrito, no el instante', () => {
    expect(parseFinishDate('2026-10-23T23:30:00-03:00')?.getTime()).toBe(local(2026, 9, 23));
  });

  it('TS-10: dato real heredado es válido', () => {
    expect(parseFinishDate('1901-08-09T04:16:48.000Z')?.getTime()).toBe(local(1901, 7, 9));
  });

  it('TS-11: Date válido se devuelve tal cual', () => {
    const d = new Date(2026, 9, 23);
    expect(parseFinishDate(d)).toBe(d);
  });

  it('TS-12: YYYY-MM-DD fuera de rango devuelve null', () =>
    expect(parseFinishDate('2026-13-45')).toBeNull());
});
