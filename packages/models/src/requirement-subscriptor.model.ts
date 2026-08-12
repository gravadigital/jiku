import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Requirement from './requirement.model';
import User from './user.model';

@Table({ timestamps: true, tableName: 'requirement_subscriptors', underscored: true })
export default class RequirementSubscriptor extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => Requirement)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    requirementId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    userId!: string;

  @BelongsTo(() => Requirement)
    requirement!: Requirement;

  @BelongsTo(() => User)
    user!: User;
}
