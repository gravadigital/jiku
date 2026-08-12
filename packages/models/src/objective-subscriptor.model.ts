import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Objective from './objectives.model';
import User from './user.model';


@Table({
  timestamps: true,
  tableName: 'objectives_subscriptors',
  underscored: true,
})

export default class ObjectiveSubscriptor extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => Objective)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
    objectiveId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    userId!: string;

  @BelongsTo(() => Objective)
    objective!: Objective;

  @BelongsTo(() => User)
    user!: User;

}
