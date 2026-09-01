import {
  Table, Model, Column, DataType, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import Requirement from './requirement.model';
import User from './user.model';

export enum RequirementActivityType {
  State = 'state',
  Comment = 'comment',
  Type = 'type',
  Priority = 'priority',
  EstimatedFinishDate = 'estimatedFinishDate',
  Tag = 'tag',
  Resolution = 'resolution',
  Title = 'title',
  Description = 'description',
}

export enum VisibilityLevel {
  Public = 'public',
  Internal = 'internal',
}

@Table({ timestamps: true, tableName: 'requirement_activity', underscored: true })
export default class RequirementActivity extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.ENUM(...Object.values(RequirementActivityType)),
    allowNull: false,
  })
    typeOfActivity!: RequirementActivityType;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
    previousValue!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
    newValue!: string;

  @Column({
    type: DataType.ENUM(...Object.values(VisibilityLevel)),
    allowNull: false,
    defaultValue: VisibilityLevel.Internal,
  })
    visibilityLevel!: VisibilityLevel;

  @ForeignKey(() => Requirement)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    requirementId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    changedBy!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    editedAt!: Date | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
    editedBy!: string | null;

  @BelongsTo(() => Requirement)
    requirement!: Requirement;

  @BelongsTo(() => User)
    changedByUser!: User;
}
