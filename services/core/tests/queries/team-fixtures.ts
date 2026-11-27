import {
  Person,
  ProjectPerson,
  UnworkedTime,
  User,
  UserProjectPermission,
  WeekAssignedTime,
  WorkedTime,
} from '@jiku/models';
import { sequelize } from '../../src/models';
import {
  PERSON_ACTIVE,
  PERSON_INACTIVE,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  REQUIREMENT,
  createTasks,
  grantProjects,
} from './task-fixtures';

/**
 * Fixtures del EQUIPO, los TIEMPOS y los PERMISOS (S-026).
 *
 * REUSA `task-fixtures.ts` en vez de duplicar el mundo: `createWorld()` crea el usuario creador,
 * el publicador confiable, los proyectos, un requisito y dos personas; `createQueryCallers()` y
 * `grantProjects()` siembran los callers y sus permisos. Acá se agrega SOLO lo que hace
 * OBSERVABLES las decisiones de esta story: la persona con usuario y la persona sin, la identidad
 * de servicio sin fila en `people`, la persona sin asignación de proyecto, el caller externo sin
 * ningún permiso, las horas imputadas a tarea Y a requisito, y la fila con hora distinta de
 * medianoche.
 *
 * LA ESCRITURA VA POR LA CONEXIÓN DE ESCRITURA con los modelos de `@jiku/models`; la LECTURA bajo
 * test va por `readDb` con SQL explícito. Esa asimetría es lo que hace que el test valga: si el
 * motor usara el ORM no habría dos caminos.
 *
 * NO SE MODIFICA `task-fixtures.ts`: cualquier cambio de comportamiento ahí rompe cuatro archivos
 * de test de S-022 a S-025.
 */

/* --------------------------------------------------------------------------------------------
 * LAS PERSONAS
 *
 * LOS APELLIDOS IMPORTAN: el sort default de `people` es `lastName, firstName`, así que el orden
 * esperado de los tests SALE DE ESTOS NOMBRES. Con los dos que ya crea `createWorld()`:
 *
 *   Acuña(7702) < Benítez(7701) < Gómez(78) < Molina(7704) < Pérez(77) < Rivas(7705) < Zapata(7703)
 * ------------------------------------------------------------------------------------------ */

/** `Carla Benítez` — CON usuario (`Q_INTERNAL`), asignada a `PROJECT_MAIN`. */
export const PERSON_LINKED = 7701;
/** `Diego Acuña` — SIN usuario. La mitad de CA-4. */
export const PERSON_NO_USER = 7702;
/** `Elena Zapata` — asignada SOLO a `PROJECT_OTHER`: lo que hace observable el recorte externo. */
export const PERSON_FOREIGN = 7703;
/** `Fabián Molina` — SIN fila en `projects_persons`: no la alcanza ningún recorte por proyecto. */
export const PERSON_UNASSIGNED = 7704;
/** `Gina Rivas` — `enabled: false`, `mustChargeWorkedTime: false`, con `end_date`. */
export const PERSON_NO_CHARGE = 7705;

/**
 * LA IDENTIDAD DE SERVICIO, SIN FILA EN `people`.
 *
 * LA AUSENCIA ES LA REGLA DE DOMINIO (CA-4, segunda mitad), no un olvido del fixture: un `Usuario`
 * con `identityType: "service"` NO REPRESENTA a nadie del equipo, y por eso no aparece en
 * `people.list`. La regla se cumple POR EL MODELO y no por un filtro que alguien pueda olvidar.
 */
export const USER_SERVICE = 'sub-identity-service';

/**
 * EL CALLER EXTERNO SIN NINGÚN PERMISO DE PROYECTO — CA-14.
 *
 * NO RECIBE `grantProjects()`, y es el punto: tiene que verse A SÍ MISMO en `users.list` aunque el
 * `EXISTS` del recorte no lo alcance. AGREGARLE UN PERMISO INVALIDA TS-38.
 */
export const Q_LONELY = 'sub-q-external-lonely';

/* --------------------------------------------------------------------------------------------
 * LAS HORAS Y LAS SEMANAS
 * ------------------------------------------------------------------------------------------ */

/** Tarea de `PROJECT_MAIN` a la que se imputan horas. */
export const TASK_WT = 9300;

/** `person 7701`, `project 12`, imputada A LA TAREA. `2026-08-10`, 120 minutos. */
export const WT_TASK = 6001;
/** `person 7701`, `project 12`, imputada AL REQUISITO. `2026-08-31` (medianoche), 90 minutos. */
export const WT_REQ = 6002;
/** `person 7702`, `project 13`, SIN tarea ni requisito. `2026-07-15`, 60 minutos. */
export const WT_OTHER = 6003;
/** `person 7701`, `project 12`, `2026-08-31 14:30:00` — la fila que hace observable H-4. */
export const WT_LATE = 6004;

/** `person 7701`, `2026-08-05`, 480 minutos, `medico`. */
export const UT_MEDICO = 6101;
/** `person 7701`, `2026-08-31`, 480 minutos, `vacaciones`. */
export const UT_VACACIONES = 6102;
/** `person 7702`, `2026-07-20`, 240 minutos, `tramite`. */
export const UT_OTHER = 6103;

/** `person 7701`, `project 12`, semana del `2026-08-03`, `internal: false`, 1200 minutos. */
export const WK_MAIN = 6201;
/** `person 7701`, `project 12`, semana del `2026-08-10`, `internal: true`, 600 minutos. */
export const WK_INTERNAL = 6202;
/** `person 7702`, `project 13`, semana del `2026-08-03`, `internal: false`, 300 minutos. */
export const WK_OTHER = 6203;

/**
 * Fija una columna de fecha POR SQL.
 *
 * Sequelize pisa los timestamps al guardar, y para `worked_times.date` el camino del comando solo
 * puede escribir medianoche. Mismo patrón que `createTasks()` y `domain-fixtures.ts`.
 */
async function setDate(table: string, id: number, column: string, value: string): Promise<void> {
  await sequelize.query(`UPDATE ${table} SET ${column} = :value WHERE id = :id`, {
    replacements: { value, id },
  });
}

/**
 * El mundo del equipo, los tiempos y los permisos.
 *
 * Se llama DESPUÉS de `createWorld()` y `createQueryCallers()`: cuelga de sus proyectos, su
 * requisito y sus callers.
 */
export async function createTeamWorld(): Promise<void> {
  await Person.bulkCreate([
    {
      id: PERSON_LINKED,
      firstName: 'Carla',
      lastName: 'Benítez',
      enabled: true,
      mustChargeWorkedTime: true,
      initDate: new Date('2026-02-01T00:00:00.000Z'),
      userId: Q_INTERNAL,
    },
    {
      id: PERSON_NO_USER,
      firstName: 'Diego',
      lastName: 'Acuña',
      enabled: true,
      mustChargeWorkedTime: true,
      initDate: new Date('2026-03-01T00:00:00.000Z'),
      // EXPLÍCITO Y NO OMITIDO: la ausencia de usuario ES LA PROPIEDAD BAJO TEST (CA-4). Una
      // persona sin `Usuario` —alguien del equipo que nunca se logueó— es un estado válido y
      // frecuente, y `people.list` con `include: ["user"]` tiene que devolver `user: null`.
      userId: null,
    },
    {
      id: PERSON_FOREIGN,
      firstName: 'Elena',
      lastName: 'Zapata',
      enabled: true,
      mustChargeWorkedTime: true,
      initDate: new Date('2026-04-01T00:00:00.000Z'),
      userId: null,
    },
    {
      id: PERSON_UNASSIGNED,
      firstName: 'Fabián',
      lastName: 'Molina',
      enabled: true,
      mustChargeWorkedTime: true,
      initDate: new Date('2026-05-01T00:00:00.000Z'),
      userId: null,
    },
    {
      id: PERSON_NO_CHARGE,
      firstName: 'Gina',
      lastName: 'Rivas',
      enabled: false,
      mustChargeWorkedTime: false,
      initDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      userId: null,
    },
  ] as any);

  // LA IDENTIDAD DE SERVICIO: fila en `users` y NINGUNA en `people`. Ver `USER_SERVICE`.
  await User.create({
    id: USER_SERVICE,
    name: 'Servicio Interno',
    username: 'svc-interno',
    email: 'svc-interno@test.local',
    roles: ['internal-app'],
    identityType: 'service',
  } as any);

  // EL CALLER SIN PERMISOS de CA-14. NO recibe `grantProjects()`.
  await User.create({
    id: Q_LONELY,
    name: 'Externa Sola',
    username: 'q-external-lonely',
    email: 'q-external-lonely@test.local',
    roles: ['external-user'],
  } as any);

  /*
   * LAS ASIGNACIONES DE PROYECTO: lo que el recorte externo de `people` alcanza.
   *
   * `PERSON_UNASSIGNED` (7704) queda AFUERA a propósito, y `PERSON_ACTIVE` (77) /
   * `PERSON_INACTIVE` (78) tampoco tienen fila —es una propiedad del mundo heredado de
   * `task-fixtures.ts`, y los tests la AFIRMAN en vez de asumirla—.
   */
  await ProjectPerson.bulkCreate([
    { projectId: PROJECT_MAIN, personId: PERSON_LINKED },
    { projectId: PROJECT_MAIN, personId: PERSON_NO_USER },
    { projectId: PROJECT_MAIN, personId: PERSON_NO_CHARGE },
    { projectId: PROJECT_OTHER, personId: PERSON_FOREIGN },
  ] as any);

  await createTasks([
    { id: TASK_WT, title: 'Tarea con horas', state: 'activo', projectId: PROJECT_MAIN },
  ]);

  /*
   * LAS CUATRO HORAS, con la exclusión mutua EJERCIDA EN LAS DOS DIRECCIONES.
   *
   * `6001` solo tarea, `6002` solo requisito, `6003` ninguna: es lo que hace que el `items: []` de
   * CA-11 sea SIGNIFICATIVO y no un falso positivo por tabla vacía.
   */
  await WorkedTime.bulkCreate([
    {
      id: WT_TASK,
      date: new Date('2026-08-10T00:00:00.000Z'),
      minutes: 120,
      projectId: PROJECT_MAIN,
      personId: PERSON_LINKED,
      objectiveId: TASK_WT,
      requirementId: null,
    },
    {
      id: WT_REQ,
      date: new Date('2026-08-31T00:00:00.000Z'),
      minutes: 90,
      projectId: PROJECT_MAIN,
      personId: PERSON_LINKED,
      objectiveId: null,
      requirementId: REQUIREMENT,
    },
    {
      id: WT_OTHER,
      date: new Date('2026-07-15T00:00:00.000Z'),
      minutes: 60,
      projectId: PROJECT_OTHER,
      personId: PERSON_NO_USER,
      objectiveId: null,
      requirementId: null,
    },
    {
      id: WT_LATE,
      date: new Date('2026-08-31T00:00:00.000Z'),
      minutes: 30,
      projectId: PROJECT_MAIN,
      personId: PERSON_LINKED,
      objectiveId: null,
      requirementId: null,
    },
  ] as any);

  // LA ÚNICA FILA CON HORA DISTINTA DE MEDIANOCHE, y NO SE PUEDE CREAR POR EL MODELO: el comando
  // `worked-times.new` valida `date` con /^\d{4}-\d{2}-\d{2}$/ (`commands/times/worked-times.ts`),
  // así que TODO lo que escribe el producto cae en 00:00:00. Esta fila representa el dato
  // histórico o cargado a mano, y es la que hace observable la inconsistencia 4 del esquema (H-4).
  await setDate('worked_times', WT_LATE, 'date', '2026-08-31 14:30:00');

  await UnworkedTime.bulkCreate([
    { id: UT_MEDICO, date: '2026-08-05', minutes: 480, reason: 'medico', personId: PERSON_LINKED },
    {
      id: UT_VACACIONES,
      date: '2026-08-31',
      minutes: 480,
      reason: 'vacaciones',
      personId: PERSON_LINKED,
    },
    { id: UT_OTHER, date: '2026-07-20', minutes: 240, reason: 'tramite', personId: PERSON_NO_USER },
  ] as any);

  await WeekAssignedTime.bulkCreate([
    {
      id: WK_MAIN,
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-07T00:00:00.000Z'),
      internal: false,
      minutes: 1200,
      projectId: PROJECT_MAIN,
      personId: PERSON_LINKED,
    },
    {
      id: WK_INTERNAL,
      dateFrom: new Date('2026-08-10T00:00:00.000Z'),
      dateTo: new Date('2026-08-14T00:00:00.000Z'),
      internal: true,
      minutes: 600,
      projectId: PROJECT_MAIN,
      personId: PERSON_LINKED,
    },
    {
      id: WK_OTHER,
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-07T00:00:00.000Z'),
      internal: false,
      minutes: 300,
      projectId: PROJECT_OTHER,
      personId: PERSON_NO_USER,
    },
  ] as any);

  // LOS PERMISOS DEL RECORTE: `Q_EXTERNAL` y `Q_MIXED` ven el 12; `Q_LONELY` NO VE NINGUNO.
  await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
  await grantProjects(Q_MIXED, [PROJECT_MAIN]);
  // LA FILA DE OTRO PROYECTO, Y SIN ELLA EL RECORTE DE `project-permissions` NO SE PUEDE FALSAR:
  // si TODAS las filas de la tabla fueran del 12, un `externalScope` borrado pasaría el test igual.
  // `Q_ADMIN` es de clase INTERNA, así que darle un permiso no le cambia lo que ve —el modo interno
  // no recorta a nivel de fila (RF-23)—: lo que agrega es una fila que el caller externo del 12 NO
  // TIENE QUE VER.
  await grantProjects(Q_ADMIN, [PROJECT_OTHER]);
}

/** Borra todo lo que crea este módulo, EN ORDEN INVERSO A LAS FK. */
export async function destroyTeamWorld(): Promise<void> {
  await WorkedTime.destroy({ where: {} });
  await UnworkedTime.destroy({ where: {} });
  await WeekAssignedTime.destroy({ where: {} });
  await ProjectPerson.destroy({ where: {} });
  await Person.destroy({
    where: {
      id: [PERSON_LINKED, PERSON_NO_USER, PERSON_FOREIGN, PERSON_UNASSIGNED, PERSON_NO_CHARGE],
    },
  });
  // LOS PERMISOS PRIMERO: `user_project_permissions.user_id` referencia `users.id`, y borrar un
  // caller con sus permisos vivos falla por la FK. `Q_LONELY` no tiene ninguno hoy y se lo borra
  // igual: el día que alguien le agregue uno, el teardown no se rompe.
  await UserProjectPermission.destroy({ where: { userId: [USER_SERVICE, Q_LONELY] } });
  await User.destroy({ where: { id: [USER_SERVICE, Q_LONELY] } });
}

/** Los ids de las personas del mundo heredado, para las aserciones que las nombran. */
export { PERSON_ACTIVE, PERSON_INACTIVE };
