import { Table, Model, Column, DataType, BelongsTo, ForeignKey } from 'sequelize-typescript';
import Project from './project.model';
import Person from './person.model';
import Objective from './objectives.model';
import Requirement from './requirement.model';

@Table({
  timestamps: true,
  tableName: 'worked_times',
  underscored: true,
})

export default class WorkedTime extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.DATE,
  })
    date!: Date;

  @Column({
    type: DataType.INTEGER,
  })
    minutes!: number;

  @ForeignKey(() => Project)
  @Column
    projectId!: number;

  @BelongsTo(() => Project)
    projects!: Project;

  @ForeignKey(() => Person)
  @Column
    personId!: number;

  @BelongsTo(() => Person)
    person!: Person;

  @ForeignKey(() => Objective)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    objectiveId!: number;

  @BelongsTo(() => Objective)
    objective!: Objective;

  @ForeignKey(() => Requirement)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    requirementId!: number | null;

  @BelongsTo(() => Requirement)
    requirement!: Requirement;


}
