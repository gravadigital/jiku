import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Objective from './objectives.model';
import User from './user.model';
import {Op} from 'sequelize';

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
  indexes: [
    {
      name: 'uk_objective_activity_external_comment',
      unique: true,
      fields: ['external_reference_url'],
      where: {
        type_of_activity: 'comment',
        external_reference_url: { [Op.ne]: null }
      }
    }
  ]
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

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'external_reference_url',
  })
    externalReferenceUrl?: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'external_user_name',
  })
    externalUserName?: string;

  @Column({
    type: DataType.STRING(128),
    allowNull: true,
    field: 'external_user_id',
  })
    externalUserId?: string;

  @BelongsTo(() => Objective)
    objective!: Objective;

  @BelongsTo(() => User)
    user!: User;
}
