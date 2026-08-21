import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Objective from './objectives.model';
import User from './user.model';

enum typeOfActivity {
  State = 'state',
  Area = 'area',
  Comment= 'comment',
  Title = 'title',
  Person = 'person',
  Priority = 'priority',
  EstimatedFinishDate = 'estimatedFinishDate',
  Description = 'description',
  StageId = 'stageId',
}

export enum activityVisibilityLevel {
  Public = 'public',
  Internal = 'internal',
}

@Table({
  timestamps: true,
  tableName: 'objective_activity',
  underscored: true,
})

export default class ObjectiveActivity extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.ENUM,
    values: [typeOfActivity.State, typeOfActivity.Area, typeOfActivity.Comment, typeOfActivity.Title, typeOfActivity.Person, typeOfActivity.Priority, typeOfActivity.EstimatedFinishDate, typeOfActivity.Description, typeOfActivity.StageId],
    allowNull: false,
  })
    typeOfActivity!: typeOfActivity;

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
    type: DataType.ENUM,
    values: [activityVisibilityLevel.Public, activityVisibilityLevel.Internal],
    allowNull: false,
    defaultValue: activityVisibilityLevel.Internal,
  })
    visibilityLevel!: activityVisibilityLevel;

  @ForeignKey(() => Objective)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
    objectiveId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING,
    allowNull: false
  })
    changedBy!: string;

  @BelongsTo(() => Objective)
    objective!: Objective;

  @BelongsTo(() => User)
    user!: User;
}
