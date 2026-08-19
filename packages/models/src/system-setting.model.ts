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

  // TEXT y no STRING(255): la lista de `file-allowed-mime-types` supera los 255 caracteres.
  // La migración `20260819_05_harden_attachments_schema.js` ya hizo el ALTER COLUMN en la base
  // real; esto alinea el modelo, que es lo que construye el esquema en `testing`/`development`
  // vía sync(). Sin este cambio la lista se trunca ahí y el fallo no señala su causa.
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
    value!: string;
}
