
import { Table, Model, Column, DataType, ForeignKey, BelongsTo, BelongsToMany, HasMany, BeforeUpdate } from 'sequelize-typescript';
import Project from './project.model';
import Person from './person.model';
import PersonObjective from './person-objective.model';
import ObjectiveActivity from './objective-activity.model';
import User from './user.model';
import WorkedTime from './worked-time.model';
import ObjectiveSubscriptor from './objective-subscriptor.model';
import ExternalProject from './external-project.model';
import Requirement from './requirement.model';

export enum statusObjective {
  Backlog = 'backlog',
  Active = 'activo',
  Finished = 'finalizado',
  Canceled = 'cancelado',
  UnderReview = 'en_revision'
}

enum areaObjective{
  Design = 'diseño',
  Development = 'desarrollo',
  Management = 'gestion',
  Research = 'investigacion',
}

enum visibilityLevel{
  Public = 'public',
  Internal = 'internal',
}

@Table({
  timestamps: true,
  tableName: 'objectives',
  underscored: true,
})

export default class Objective extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    description!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
    estimatedFinishDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    finishedAt!: Date | null;

  @Column({
    type: DataType.ENUM,
    values: [statusObjective.Backlog, statusObjective.Active, statusObjective.Finished, statusObjective.Canceled, statusObjective.UnderReview],
    defaultValue: statusObjective.Backlog,
    allowNull: false,
  })
    state!: statusObjective;

  @Column({
    type: DataType.ENUM,
    values: [areaObjective.Design, areaObjective.Development, areaObjective.Management, areaObjective.Research],
    allowNull: false,
  })
    area!: areaObjective;

  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
    priority!: number;

  @Column({
    type: DataType.ENUM,
    values: [visibilityLevel.Public, visibilityLevel.Internal],
    allowNull: false,
    defaultValue: visibilityLevel.Public,
  })
    visibilityLevel!: visibilityLevel;

  @ForeignKey(() => Project)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
    projectId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
    createdBy!: string;

  // External issue tracking columns (Jira Integration)
  @ForeignKey(() => ExternalProject)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    externalProjectId!: number | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
    externalIssueId!: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
    externalIssueKey!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    externalUrl!: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    externalRawData!: Record<string, any> | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    lastSyncedAt!: Date | null;

  @BelongsTo(() => Project)
    project!: Project;

  @BelongsTo(() => ExternalProject)
    externalProject!: ExternalProject;

  @BelongsToMany(() => Person, () => PersonObjective)
    persons!: Person[];

  @BelongsTo(() => User)
    creator!: User;

  @HasMany(() => ObjectiveActivity)
    ObjectiveActivity!: ObjectiveActivity[];

  @ForeignKey(() => Requirement)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    requirementId!: number | null;

  @BelongsTo(() => Requirement, { constraints: false })
    requirement!: Requirement;

  @HasMany(() => WorkedTime)
    workedTime!: WorkedTime[];

  @HasMany(()=> ObjectiveSubscriptor)
    objectiveSubscriptors!: ObjectiveSubscriptor[];

  @BeforeUpdate
  static setFinishedAt(objective: Objective) {
    const previousState = objective.previous('state');
    const currentState = objective.state;

    if (
      objective.changed('state') &&
        currentState === statusObjective.Finished &&
        previousState !== statusObjective.Finished
    ) {
      objective.finishedAt = new Date();
    }

    if (
      objective.changed('state') &&
        previousState === statusObjective.Finished &&
        currentState !== statusObjective.Finished
    ) {
      objective.finishedAt = null;
    }
  }


}

