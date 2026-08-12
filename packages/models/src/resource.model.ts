import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Project from './project.model';

@Table({
  timestamps: true,
  tableName: 'resources',
  underscored: true,
})

export default class Resource extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;
  
  @Column({
    type: DataType.STRING,
  })
    key!: string;

  @Column({
    type: DataType.STRING,
  })
    value!: string;
  
  @ForeignKey(() => Project)
  @Column
    projectId!: number;
  
  @BelongsTo(() => Project)
    project!: Project;
}