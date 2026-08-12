import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import User from './user.model';
import Project from './project.model';

@Table({
  timestamps: true,
  tableName: 'user_project_permissions',
  underscored: true,
})
export default class UserProjectPermission extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    userId!: string;

  @ForeignKey(() => Project)
  @Column
    projectId!: number;

  @BelongsTo(() => User)
    user!: User;

  @BelongsTo(() => Project)
    project!: Project;
}
