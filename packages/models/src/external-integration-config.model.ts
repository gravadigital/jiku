import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import Client from './client.model';
import ExternalProject from './external-project.model';

@Table({
  timestamps: true,
  tableName: 'external_integration_config',
  underscored: true,
})
export default class ExternalIntegrationConfig extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @ForeignKey(() => Client)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    clientId!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['jira', 'github', 'gitlab', 'linear']],
    },
  })
    systemType!: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
    baseUrl!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    authEmail!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
    authTokenEncrypted!: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
    enabled!: boolean;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
    config!: Record<string, any> | null;

  // Associations
  @BelongsTo(() => Client)
    client!: Client;

  @HasMany(() => ExternalProject)
    externalProjects!: ExternalProject[];
}
