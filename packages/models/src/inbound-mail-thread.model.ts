import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Requirement from './requirement.model';

@Table({
  timestamps: true,
  updatedAt: false,
  tableName: 'inbound_mail_threads',
  underscored: true,
  indexes: [
    { unique: true, name: 'uk_inbound_mail_threads_message_id', fields: ['message_id'] },
    { name: 'idx_inbound_mail_threads_requirement_id', fields: ['requirement_id'] },
  ],
})
export default class InboundMailThread extends Model {
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
    onDelete: 'CASCADE',
  })
    requirementId!: number;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
    messageId!: string;

  @BelongsTo(() => Requirement, { onDelete: 'CASCADE' })
    requirement!: Requirement;
}
