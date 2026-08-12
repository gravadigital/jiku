import {
  Table, Model, Column, DataType, ForeignKey, BelongsTo, BelongsToMany, HasMany, BeforeUpdate,
} from 'sequelize-typescript';
import User from './user.model';
import Project from './project.model';
import Person from './person.model';
import PersonRequirement from './person-requirement.model';
import RequirementActivity from './requirement-activity.model';

export enum RequirementVisibilityLevel {
  Public = 'public',
  Internal = 'internal',
}

export enum RequirementType {
  Funcionalidad = 'funcionalidad',
  Mejora = 'mejora',
  Incidencia = 'incidencia',
  Otro = 'otro',
}

export enum RequirementPriority {
  SinPrioridad = 'sin_prioridad',
  Baja = 'baja',
  Media = 'media',
  Alta = 'alta',
  Urgente = 'urgente',
}

export enum RequirementState {
  Analisis      = 'analisis',
  Planificacion = 'planificacion',
  EnCola        = 'en_cola',
  Desarrollo    = 'desarrollo',
  Revision      = 'revision',
  Resuelto      = 'resuelto',
  Cancelado     = 'cancelado',
}

export enum RequirementResolution {
  ErrorInterno    = 'error_interno',
  FueraDeAlcance  = 'fuera_de_alcance',
  ErrorExterno    = 'error_externo',
  Discutible      = 'discutible',
  Otro            = 'otro',
}

@Table({ timestamps: true, tableName: 'requirements', underscored: true })
export default class Requirement extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
    description!: string;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementType)),
    allowNull: true,
  })
    type!: RequirementType | null;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementPriority)),
    allowNull: false,
    defaultValue: RequirementPriority.SinPrioridad,
  })
    priority!: RequirementPriority;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementState)),
    allowNull: false,
    defaultValue: RequirementState.Analisis,
  })
    state!: RequirementState;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
  })
    estimatedFinishDate!: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    tags!: Array<{ key: string; value: string }> | null;

  @ForeignKey(() => Project)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    projectId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    createdBy!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: null,
  })
    scheduledAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: null,
  })
    inProgressAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: null,
  })
    inReviewAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: null,
  })
    finishedAt!: Date | null;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementVisibilityLevel)),
    allowNull: false,
    defaultValue: RequirementVisibilityLevel.Public,
  })
    visibilityLevel!: RequirementVisibilityLevel;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementResolution)),
    allowNull: true,
  })
    resolutionType!: RequirementResolution | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    resolutionConclusion!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    resolutionComment!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    scope!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    technicalSolution!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    acceptanceCriteria!: string | null;

  @BelongsTo(() => Project)
    project!: Project;

  @BelongsToMany(() => Person, () => PersonRequirement)
    responsiblePeople!: Person[];

  @BelongsTo(() => User)
    creator!: User;

  @HasMany(() => RequirementActivity)
    requirementActivities!: RequirementActivity[];

  activityLog?: FieldActivityChange[];

  @BeforeUpdate
  static logFieldActivityAndSetTimestamps(req: Requirement) {
    const changes: FieldActivityChange[] = [];

    if (req.changed('title')) {
      changes.push({ type: 'title', previous: req.previous('title') as string, next: req.title });
    }
    if (req.changed('description')) {
      changes.push({ type: 'description', previous: req.previous('description') as string, next: req.description });
    }

    if (req.changed('state') && req.previous('state') !== req.state) {
      const prev = req.previous('state') as RequirementState;
      const next = req.state;

      changes.push({ type: 'state', previous: prev, next });

      if (next === RequirementState.Planificacion && !req.scheduledAt)  req.scheduledAt  = new Date();
      if (next === RequirementState.Desarrollo    && !req.inProgressAt) req.inProgressAt = new Date();
      if (next === RequirementState.Revision      && !req.inReviewAt)   req.inReviewAt   = new Date();
      if (next === RequirementState.Resuelto      && !req.finishedAt)   req.finishedAt   = new Date();
    }

    req.activityLog = changes;
  }
}

export interface FieldActivityChange {
  type: 'title' | 'description' | 'state';
  previous: string;
  next: string;
}
