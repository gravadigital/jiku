import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Requirement from './requirement.model';

@Table({
  timestamps: true,
  tableName: 'requirement_mail_threads',
  underscored: true,
})
export default class RequirementMailThread extends Model {
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
    unique: true,
  })
    requirementId!: number;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
    messageId!: string;

  @Column({ type: DataType.STRING(100), allowNull: true })
    mattermostPostId!: string | null;

  @BelongsTo(() => Requirement)
    requirement!: Requirement;
}
