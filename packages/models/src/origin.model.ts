import { Table, Model, Column, DataType } from 'sequelize-typescript';

@Table({
  timestamps: true,
  tableName: 'origins',
  underscored: true,
})

export default class Origin extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;
  
  @Column({
    type: DataType.INTEGER,
  })
    reference!: number;

  @Column({
    type: DataType.STRING,
  })
    name!: string;
}