import { Table, Model, Column, ForeignKey, DataType } from 'sequelize-typescript';
import Objective from './objectives.model';
import Person from './person.model';

@Table({
  timestamps: true,
  tableName: 'people_objectives',
  underscored: true,
})

export default class PersonObjective extends Model {
    @Column({
      type: DataType.BOOLEAN,
    })
      isLeader!: boolean;

    @Column({
      type: DataType.BOOLEAN,
    })
      active!: boolean;  

    @ForeignKey(() => Person)
    @Column
      personId!: number;
  
    @ForeignKey(() => Objective)
    @Column
      objectiveId!: number;
}