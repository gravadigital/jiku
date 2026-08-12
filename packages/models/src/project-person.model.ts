import { Table, Model, Column, ForeignKey } from 'sequelize-typescript';
import Project from './project.model';
import Person from './person.model';

@Table({
  timestamps: true,
  tableName: 'projects_persons',
  underscored: true,
})

export default class ProjectPerson extends Model {
    @ForeignKey(() => Project)
    @Column
      projectId!: number;
  
    @ForeignKey(() => Person)
    @Column
      personId!: number;
}