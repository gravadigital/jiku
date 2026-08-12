import { Table, Model, Column, DataType } from 'sequelize-typescript';

@Table({
  timestamps: true,
  tableName: 'system_settings',
  underscored: true,
})

export default class SystemSetting extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
    key!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    value!: string;
}
