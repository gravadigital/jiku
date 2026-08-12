import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import ExternalIntegrationConfig from './external-integration-config.model';
import ExternalProject from './external-project.model';

@Table({
  timestamps: false,
  tableName: 'external_sync_event',
  underscored: true,
})
export default class ExternalSyncEvent extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => ExternalIntegrationConfig)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    integrationId!: number;

  @ForeignKey(() => ExternalProject)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    externalProjectId!: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
    startedAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    finishedAt!: Date | null;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['pending', 'success', 'failure', 'partial']],
    },
  })
    status!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
    issuesCreated!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
    issuesUpdated!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
    issuesFailed!: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    errors!: Array<{ message: string; details?: any; timestamp?: Date }> | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    metadata!: Record<string, any> | null;

  // Associations
  @BelongsTo(() => ExternalIntegrationConfig)
    integration!: ExternalIntegrationConfig;

  @BelongsTo(() => ExternalProject)
    externalProject!: ExternalProject;
}
