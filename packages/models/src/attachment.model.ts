import {
  Table, Model, Column, DataType,
  ForeignKey, BelongsTo, BeforeDestroy,
  DefaultScope, Scopes
} from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import User from './user.model';

export enum AttachmentEntityType {
  Objective = 'objective',
  Project = 'project',
  Stage = 'stage',
  Comment = 'comment',
  CommentDraft = 'comment_draft',
  ObjectiveDraft = 'objective_draft',
  Requirement = 'requirement',
  RequirementDraft = 'requirement_draft',
  ObjectiveComment = 'objective_comment',
  RequirementComment = 'requirement_comment',
  ObjectiveCommentDraft = 'objective_comment_draft',
  RequirementCommentDraft = 'requirement_comment_draft',
}

export enum RetentionStatus {
  Active = 'active',
  ScheduledForDeletion = 'scheduled_for_deletion',
  Deleted = 'deleted',
}

@DefaultScope(() => ({
  attributes: { exclude: ['checksum'] }
}))
@Scopes(() => ({
  active: {
    where: { deletedAt: null }
  }
}))
@Table({
  timestamps: true,
  tableName: 'attachments',
  underscored: true,
  paranoid: false,
})
export default class Attachment extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    entityType!: AttachmentEntityType;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    entityId!: number | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    fileName!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10 * 1024 * 1024,  // 10MB
    },
  })
    fileSize!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    mimeType!: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    unique: true,
  })
    storageKey!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    storageBucket!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
    storageRegion!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    uploadedBy!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    description!: string | null;

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
  })
    checksum!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: RetentionStatus.Active,
  })
    retentionStatus!: RetentionStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    deletedAt!: Date | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
    deletedBy!: string | null;

  @BelongsTo(() => User, { foreignKey: 'uploadedBy', as: 'uploader' })
    uploader!: User;

  @BelongsTo(() => User, { foreignKey: 'deletedBy', as: 'deleter' })
    deleter!: User | null;

  @BeforeDestroy
  static softDeleteHook(_attachment: Attachment, options: any) {
    if (!options.force) {
      throw new Error(
        'Physical deletion is not allowed. Use attachment.softDelete() instead.'
      );
    }
  }

  async softDelete(deletedByUserId?: string, options?: { transaction?: Transaction }): Promise<void> {
    await this.update({
      retentionStatus: RetentionStatus.ScheduledForDeletion,
      deletedAt: new Date(),
      deletedBy: deletedByUserId || null,
    }, options);
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isPdf(): boolean {
    return this.mimeType === 'application/pdf';
  }

  canPreview(): boolean {
    return this.isImage() || this.isPdf();
  }
}
