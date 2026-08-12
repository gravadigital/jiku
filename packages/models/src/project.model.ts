

import { Table, Model, Column, DataType, BelongsToMany, HasMany, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Client from './client.model';
import Person from './person.model';
import ProjectPerson from './project-person.model';
import ProjectStatusUpdate from './project-status-update.model';
import Objective from './objectives.model';
import User from './user.model';
import Resource from './resource.model';
import WorkedTime from './worked-time.model';
import WeekAssignedTime from './week-assigned-time.model';

enum typeProject {
  Internal = 'interno',
  Commercial = 'comercial',
  Investigation = 'investigacion',
  Proposal = 'propuesta'
}

export enum DefaultKeyValuePairs {
  documentacion = 'documentacion',
  diseño = 'diseño',
  board_de_tareas = 'board_de_tareas',
  mattermost_group_name = 'mattermost_group_name'
}

export const defaultKeyValuePairsList = Object.values(DefaultKeyValuePairs);

enum statusProject {
  Analysis = 'analisis',
  Active = 'activo',
  Inactive = 'inactivo',
  Finished = 'finalizado',
  Canceled = 'cancelado'
}

@Table({
  timestamps: true,
  tableName: 'projects',
  underscored: true,
})

export default class Project extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING,
  })
    code!: string;

  @Column({
    type: DataType.STRING,
  })
    name!: string;

  @Column({
    type: DataType.ENUM,
    values: [typeProject.Commercial, typeProject.Internal, typeProject.Investigation, typeProject.Proposal],
    allowNull: false,
  })
    type!: typeProject;

  @Column({
    type: DataType.TEXT,
  })
    description!: string;

  @Column({
    type: DataType.ENUM,
    values: [statusProject.Analysis, statusProject.Active, statusProject.Inactive, statusProject.Finished, statusProject.Canceled],
    allowNull: false,
  })
    status!: statusProject;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
    initDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
    endDate!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: 0
  })
    priority!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
    originId!: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
    keyValuePairs!: { [key: string]: string | null };

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    unique: true,
  })
    ticketSlug!: string | null;

  @ForeignKey(() => User)
    @Column({
      type: DataType.STRING,
      allowNull: false
    })
    createdBy!: string;

  @ForeignKey(() => Client)
    @Column({
      type: DataType.INTEGER,
      allowNull: true
    })
    clientId!: number;

  @BelongsTo(() => Client)
    client!: Client;

  @BelongsToMany(() => Person, () => ProjectPerson)
    persons!: Person[];

  @BelongsTo(() => User)
    creator!: User;

  @HasMany(() => Objective)
    objectives!: Objective[];

  @HasMany(() => Resource)
    resources!: Resource[];

  @HasMany(() => ProjectStatusUpdate)
    statusUpdates!: ProjectStatusUpdate[];

  @HasMany(() => WorkedTime)
    workedTimes!: WorkedTime[];

  @HasMany(() => WeekAssignedTime)
    weekAssignedTimes!: WeekAssignedTime[];


}



