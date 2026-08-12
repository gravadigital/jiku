import { Table, Model, Column, ForeignKey, DataType } from 'sequelize-typescript';
import Requirement from './requirement.model';
import Person from './person.model';

@Table({
  timestamps: true,
  tableName: 'people_requirements',
  underscored: true,
})

export default class PersonRequirement extends Model {
  @Column({
    type: DataType.BOOLEAN,
  })
    isLeader!: boolean | null;

  @ForeignKey(() => Person)
  @Column
    personId!: number;

  @ForeignKey(() => Requirement)
  @Column
    requirementId!: number;
}
