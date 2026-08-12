import { Table, Model, Column, DataType, BelongsToMany, HasMany, BelongsTo, ForeignKey } from 'sequelize-typescript';
import Project from './project.model';
import ProjectPerson from './project-person.model';
import WorkedTime from './worked-time.model';
import UnworkedTime from './unworked-time.model';
import WeekAssignedTime from './week-assigned-time.model';
import Objective from './objectives.model';
import PersonObjective from './person-objective.model';
import Requirement from './requirement.model';
import PersonRequirement from './person-requirement.model';
import User from './user.model';

@Table({
  timestamps: true,
  tableName: 'people',
  underscored: true,
})

export default class Person extends Model {
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
    firstName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    lastName!: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
    enabled!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
    initDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    endDate!: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
    mustChargeWorkedTime!: boolean;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
    userId!: string;

  @BelongsToMany(() => Project, () => ProjectPerson)
    projects!: Project[];

  @HasMany(() => WorkedTime)
    workedTimes!: WorkedTime[];

  @HasMany(() => UnworkedTime)
    unworkedTimes!: UnworkedTime[];

  @HasMany(() => WeekAssignedTime)
    weekAssignedTimes!: WeekAssignedTime[];

  @BelongsToMany(() => Objective, () => PersonObjective)
    objectives!: Objective[];

  @BelongsToMany(() => Requirement, () => PersonRequirement)
    requirements!: Requirement[];

  @BelongsTo(() => User)
    user!: User;
}
