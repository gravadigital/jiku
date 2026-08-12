import { Table, Model, Column, DataType, HasMany, HasOne } from 'sequelize-typescript';
import ObjectiveActivity from './objective-activity.model';
import Objective from './objectives.model';
import Project from './project.model';
import Person from './person.model';

@Table({
  timestamps: true,
  tableName: 'users',
  underscored: true,
})

export default class User extends Model {
  @Column({
    type: DataType.STRING(100),
    primaryKey: true,
  })
    id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    username!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    email!: string;

  @HasMany(() => ObjectiveActivity)
    ObjectiveActivity!: ObjectiveActivity[];

    @HasMany(() => Project)
      projects!: Project[];

  @HasMany(() => Objective)
    objectives!: Objective[];

  @HasOne(() => Person)
    person!: Person;
}
