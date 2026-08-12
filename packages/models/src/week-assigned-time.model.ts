import { Table, Model, Column, DataType, BelongsTo, ForeignKey } from 'sequelize-typescript';
import Project from './project.model';
import Person from './person.model';

@Table({
  timestamps: true,
  tableName: 'week_assigned_times',
  underscored: true,
})

export default class WeekAssignedTime extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;
  
  @Column({
    type: DataType.DATE,
  })
    dateFrom!: Date;

  @Column({
    type: DataType.DATE,
  })
    dateTo!: Date;

  @Column({
    type: DataType.BOOLEAN
  })
    internal!: boolean;

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
}