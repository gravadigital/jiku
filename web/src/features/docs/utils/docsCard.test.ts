import { describe, it, expect } from 'vitest';
import { cardFilters, cardInitial, countLabel, seeAllHref } from './docsCard';
import { parseDocsSearch } from './docsSearchParams';

describe('docsCard', () => {
  it('TS-1: cardFilters por entidad', () => {
    expect(cardFilters({ projectId: 12 })).toStrictEqual({
      projectId: [12],
      count: true,
      sort: '-updatedAt',
      limit: 5,
    });
    expect(cardFilters({ requirementId: 45 })).toStrictEqual({
      requirementId: 45,
      count: true,
      sort: '-updatedAt',
      limit: 5,
    });
    expect(cardFilters({ taskId: 7 })).toStrictEqual({
      taskId: 7,
      count: true,
      sort: '-updatedAt',
      limit: 5,
    });
  });

  it('TS-2: seeAllHref y su ida y vuelta', () => {
    const cases = [
      [{ projectId: 12 }, '/docs?proyecto=12&origen=proyecto', 'proyecto', 12],
      [{ requirementId: 45 }, '/docs?requisito=45&origen=requisito', 'requisito', 45],
      [{ taskId: 7 }, '/docs?tarea=7&origen=tarea', 'tarea', 7],
    ] as const;
    for (const [scope, href, kind, id] of cases) {
      expect(seeAllHref(scope)).toBe(href);
      const state = parseDocsSearch(new URLSearchParams(href.split('?')[1]));
      expect(state.origen).toBe(kind);
      expect(state.tokens).toEqual([{ kind, id }]);
    }
  });

  it('TS-3: cardInitial sin claves undefined', () => {
    expect(cardInitial({ projectId: 12 }, { clientId: 4 })).toStrictEqual({
      projectId: 12,
      clientId: 4,
    });
    expect(cardInitial({ projectId: 12 }, undefined)).toStrictEqual({ projectId: 12 });
    expect(
      cardInitial({ requirementId: 45 }, { projectId: 12, title: 'Login con SSO' })
    ).toStrictEqual({ projectId: 12, requirement: { id: 45, title: 'Login con SSO' } });
    expect(
      cardInitial({ taskId: 7 }, { projectId: 7, title: 'Migrar el header a ViewHeader' })
    ).toStrictEqual({ projectId: 7, task: { id: 7, title: 'Migrar el header a ViewHeader' } });
    expect(cardInitial({ taskId: 7 }, undefined)).toStrictEqual({ task: { id: 7, title: null } });
  });

  it('TS-4: countLabel', () => {
    expect(countLabel({ limit: 5, returned: 5, total: 12 })).toBe('12');
    expect(countLabel({ limit: 5, returned: 5, cursor: 'c1' })).toBe('5+');
    expect(countLabel({ limit: 5, returned: 2 })).toBe('2');
    expect(countLabel({ limit: 5, returned: 0, total: 0 })).toBe('0');
  });
});
