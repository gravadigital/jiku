import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import ExternalIntegrationConfig from './external-integration-config.model';
import Project from './project.model';
import Objective from './objectives.model';
import {Op} from 'sequelize';

@Table({
  timestamps: true,
  tableName: 'external_project',
  underscored: true,
  indexes: [
    {
      name: 'idx_external_project_prefix',
      fields: ['prefix'],
      where: {
        prefix: { [Op.ne]: null }
      }
    },
    {
      name: 'idx_external_project_integration_project',
      fields: ['integration_id', 'external_project_id']
    },
    {
      name: 'idx_external_project_unique_prefix',
      unique: true,
      fields: ['integration_id', 'external_project_id', 'prefix']
    }
  ]
})
export default class ExternalProject extends Model {
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

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    externalProjectId!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    externalProjectKey!: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
    name!: string;

  @ForeignKey(() => Project)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    localProjectId!: number | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    config!: Record<string, any> | null;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    comment: 'Optional prefix filter for Jira issue titles. NULL = sync all issues. Example: [VIS], [RIMS]',
  })
    prefix!: string | null;

  // Associations
  @BelongsTo(() => ExternalIntegrationConfig)
    integration!: ExternalIntegrationConfig;

  @BelongsTo(() => Project)
    localProject!: Project;

  @HasMany(() => Objective)
    objectives!: Objective[];
}
