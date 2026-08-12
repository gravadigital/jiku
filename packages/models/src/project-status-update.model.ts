import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Project from './project.model';

@Table({
  timestamps: true,
  tableName: 'project_status_updates',
  underscored: true,
})

export default class ProjectStatusUpdate extends Model {
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
    status!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
    updateDate!: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    comment!: string;

  @ForeignKey(() => Project)
  @Column
    projectId!: number;
  
  @BelongsTo(() => Project)
    project!: Project;
}