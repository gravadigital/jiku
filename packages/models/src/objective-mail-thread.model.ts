import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Objective from './objectives.model';

@Table({
  timestamps: true,
  tableName: 'objective_mail_threads',
  underscored: true,
})
export default class ObjectiveMailThread extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => Objective)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
  })
    objectiveId!: number;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
    messageId!: string;

  @Column({ type: DataType.STRING(100), allowNull: true })
    mattermostPostId!: string | null;

  @BelongsTo(() => Objective)
    objective!: Objective;
}
