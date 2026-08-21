import { Table, Model, Column, DataType, HasMany, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import Project from './project.model';

@Table({
  timestamps: true,
  tableName: 'clients',
  underscored: true,
})
export default class Client extends Model {
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
    name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    description!: string | null;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
    createdAt!: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
    updatedAt!: Date;

  @HasMany(() => Project)
    projects!: Project[];

}
