import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as objectivesApi from '@/features/objectives/services/objectivesApi';
import Objectives from './page';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/objectives/services/objectivesApi');

describe('Objectives (by-responsible)', () => {
  it('TS-13 (S-067): muestra título "Tareas por responsable"', async () => {
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([]);

    render(await Objectives());

    expect(screen.getByRole('heading', { name: 'Tareas por responsable' })).toBeInTheDocument();
  });
});
