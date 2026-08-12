'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import ReactSelect from 'react-select';
import { toast } from 'react-toastify';
import { usePersons } from '@/features/auth/hooks/usePersons';
import { useHoursPerDay } from '@/features/time-allocation/hooks/useHoursPerDay';
import { Select } from '@/shared/components/ui/Select';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';
import { useCreateUnworkedTime } from '../../hooks/useCreateUnworkedTime';
import { useCreateWorkedTime } from '../../hooks/useCreateWorkedTime';
import { useUnworkedTimesReasons } from '../../hooks/useUnworkedTimesReasons';
import { useUnworkedTimesReport } from '../../hooks/useUnworkedTimesReport';
import { useWorkedTimesRange } from '../../hooks/useWorkedTimesRange';
import { buildWorkedTimePayload } from '../../utils/buildWorkedTimePayload';
import { DayEntriesList } from '../DayEntriesList';
import { DaySelector } from '../DaySelector';
import { TargetSelector } from '../TargetSelector';
import { TimeButtons } from '../TimeButtons';
import styles from './WorkedTimesPage.module.scss';
import type { TargetSelection } from '../../types/worked-time.types';
import type { ApiError } from '@/lib/axios';

type AttendanceMode = 'presente' | 'ausente';

const ATTENDANCE_MODE_OPTIONS = [
  { key: 'presente' as AttendanceMode, label: 'Presente' },
  { key: 'ausente' as AttendanceMode, label: 'Ausente' },
] as const;

const reasonSelectStyles = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: (provided: any, state: any) => ({
    ...provided,
    '&:hover': { cursor: 'pointer' },
    backgroundColor: '#fff',
    border: '0.5px solid var(--color-general-border)',
    borderRadius: 'var(--radius-items)',
    color: 'var(--color-general-title)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 400,
    lineHeight: '1.5rem',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    width: '100%',
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: (provided: any) => ({ ...provided, margin: 0, paddingTop: 0, paddingBottom: 0 }),
};

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getLastWeekday = (): string => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) d.setDate(d.getDate() - 2);
  else if (dayOfWeek === 6) d.setDate(d.getDate() - 1);
  return formatDateStr(d);
};

const getVisibleDates = (): string[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays: string[] = [];
  let daysBack = 0;
  while (weekdays.length < 8) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysBack);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) weekdays.push(formatDateStr(d));
    daysBack++;
  }
  return weekdays;
};

export function WorkedTimesPage() {
  const { data: session } = useSession();
  const userRoles = session?.user?.roles ?? [];
  const isAdmin = userRoles.includes('admin');
  const zitadelId = session?.user?.zitadelId;

  const { data: persons = [] } = usePersons();

  const currentPerson = useMemo(() => {
    if (!zitadelId || persons.length === 0) return null;
    return persons.find((p) => p.userId === zitadelId) ?? null;
  }, [zitadelId, persons]);

  const [selectedDate, setSelectedDate] = useState(getLastWeekday());
  const [selectedTarget, setSelectedTarget] = useState<TargetSelection | null>(null);
  const [selectedHours, setSelectedHours] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [mode, setMode] = useState<AttendanceMode>('presente');
  const [selectedReason, setSelectedReason] = useState('');

  const createMutation = useCreateWorkedTime();
  const createUnworkedMutation = useCreateUnworkedTime();
  const { data: reasons = [], isLoading: isLoadingReasons } = useUnworkedTimesReasons();

  const reasonOptions = useMemo(
    () => reasons.map((r) => ({ value: r.value, label: r.label })),
    [reasons]
  );

  const effectivePersonId = useMemo(() => {
    if (isAdmin && selectedPersonId) {
      return parseInt(selectedPersonId, 10);
    }
    return currentPerson?.id ?? 0;
  }, [isAdmin, selectedPersonId, currentPerson]);

  // projectId efectivo: TargetSelector siempre lo resuelve directamente
  // (proyecto/requisito/tarea), sin necesidad de derivarlo de otras queries.
  const resolvedProjectId = useMemo<number | null>(
    () => selectedTarget?.projectId ?? null,
    [selectedTarget]
  );

  const personOptions = useMemo(() => {
    return persons
      .filter((p) => p.enabled)
      .map((p) => ({
        label: `${p.firstName} ${p.lastName}`,
        value: String(p.id),
      }));
  }, [persons]);

  const displayPersonId = selectedPersonId ?? (currentPerson ? String(currentPerson.id) : '');

  const visibleDates = useMemo(() => getVisibleDates(), []);
  const { data: hoursPerDayData } = useHoursPerDay();
  const { data: rangeEntries = [] } = useWorkedTimesRange(visibleDates, effectivePersonId);

  const visibleDateFrom = visibleDates[visibleDates.length - 1];
  const visibleDateTo = visibleDates[0];
  const { data: unworkedRangeDays = [] } = useUnworkedTimesReport({
    dateFrom: visibleDateFrom,
    dateTo: visibleDateTo,
    personId: effectivePersonId || undefined,
  });

  const dailyMinutes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of rangeEntries) {
      const date = entry.date.slice(0, 10);
      map[date] = (map[date] ?? 0) + entry.minutes;
    }
    for (const day of unworkedRangeDays) {
      map[day.date] = (map[day.date] ?? 0) + day.totalMinutes;
    }
    return map;
  }, [rangeEntries, unworkedRangeDays]);

  const completedThreshold = (hoursPerDayData?.hoursPerDay ?? 6) * 60;

  const totalMinutes = selectedHours * 60 + selectedMinutes;

  const canSubmit = useMemo(() => {
    if (totalMinutes === 0 || effectivePersonId === 0) return false;
    if (mode === 'presente') return resolvedProjectId != null;
    return !!selectedReason;
  }, [mode, totalMinutes, effectivePersonId, resolvedProjectId, selectedReason]);

  const handleModeChange = useCallback((newMode: AttendanceMode) => {
    setMode(newMode);
    setSelectedReason('');
    setSelectedTarget(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (totalMinutes === 0 || effectivePersonId === 0) return;

    if (mode === 'presente') {
      const payload = buildWorkedTimePayload(
        selectedTarget,
        selectedDate,
        totalMinutes,
        isAdmin ? effectivePersonId : undefined,
        resolvedProjectId
      );
      if (!payload) return;
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Horas cargadas exitosamente');
          setSelectedTarget(null);
          setSelectedHours(0);
          setSelectedMinutes(0);
        },
        onError: (error) => {
          const apiError = error as unknown as ApiError;
          toast.error(apiError.message || 'Error al cargar horas');
        },
      });
    } else {
      if (!selectedReason) return;
      createUnworkedMutation.mutate(
        {
          date: selectedDate,
          minutes: totalMinutes,
          reason: selectedReason,
          personId: isAdmin ? effectivePersonId : undefined,
        },
        {
          onSuccess: () => {
            toast.success('Ausencia registrada exitosamente');
            setMode('presente');
            setSelectedReason('');
            setSelectedHours(0);
            setSelectedMinutes(0);
          },
          onError: (error) => {
            const apiError = error as unknown as ApiError;
            toast.error(apiError.message || 'Error al registrar ausencia');
          },
        }
      );
    }
  }, [
    mode,
    selectedTarget,
    resolvedProjectId,
    selectedReason,
    totalMinutes,
    selectedDate,
    effectivePersonId,
    isAdmin,
    createMutation,
    createUnworkedMutation,
  ]);

  const isSubmitting = createMutation.isPending || createUnworkedMutation.isPending;

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        {isAdmin && (
          <>
            <Select
              label="Persona"
              code="person-selector"
              value={displayPersonId}
              options={personOptions}
              onChange={setSelectedPersonId}
              placeholder="Seleccionar persona..."
            />
            <hr className={styles.divider} />
          </>
        )}

        <DaySelector
          selectedDate={selectedDate}
          onDayChange={setSelectedDate}
          dailyMinutes={dailyMinutes}
          completedThreshold={completedThreshold}
        />

        <hr className={styles.divider} />

        <ToggleGroup options={ATTENDANCE_MODE_OPTIONS} value={mode} onChange={handleModeChange} />

        <hr className={styles.divider} />

        {mode === 'presente' ? (
          <TargetSelector
            personId={effectivePersonId}
            value={selectedTarget}
            onSelect={setSelectedTarget}
          />
        ) : (
          <div className={styles.absenceSelect}>
            <label htmlFor="absence-reason">Motivo de ausencia:</label>
            <ReactSelect
              inputId="absence-reason"
              instanceId="absence-reason"
              options={reasonOptions}
              value={reasonOptions.find((o) => o.value === selectedReason) ?? null}
              onChange={(opt) => setSelectedReason(opt ? opt.value : '')}
              placeholder={isLoadingReasons ? 'Cargando motivos...' : 'Seleccioná un motivo...'}
              isClearable
              styles={reasonSelectStyles}
              noOptionsMessage={() => 'Sin resultados'}
            />
          </div>
        )}

        <hr className={styles.divider} />

        <TimeButtons
          selectedHours={selectedHours}
          selectedMinutes={selectedMinutes}
          onHoursChange={setSelectedHours}
          onMinutesChange={setSelectedMinutes}
          onSubmit={handleSubmit}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
        />
      </div>

      <DayEntriesList date={selectedDate} personId={effectivePersonId} />
    </div>
  );
}
