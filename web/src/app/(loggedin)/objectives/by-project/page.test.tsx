import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as projectsApi from '@/features/projects/services/projectsApi';
import Objectives from './page';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('./ScrollToProject', () => ({ ScrollToProject: () => null }));
vi.mock('@/features/projects/services/projectsApi');

describe('Objectives (by-project)', () => {
  it('TS-12 (S-067): muestra título "Tareas por proyecto"', async () => {
    vi.mocked(projectsApi.getProjectsObjectivesSummary).mockResolvedValue([]);

    render(await Objectives());

    expect(screen.getByRole('heading', { name: 'Tareas por proyecto' })).toBeInTheDocument();
  });
});
