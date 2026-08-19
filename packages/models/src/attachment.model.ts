import {
  Table, Model, Column, DataType,
  ForeignKey, BelongsTo, BeforeDestroy,
  DefaultScope, Scopes
} from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import User from './user.model';
import File from './file.model';
import { RetentionStatus } from './retention-status.enum';

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

// Se re-exporta para no romper a quien lo importa desde acá. La definición vive fuera del
// ciclo Attachment <-> File: ver retention-status.enum.ts
export { RetentionStatus };

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

  /**
   * SIN `unique: true` desde S-003, a propósito.
   *
   * Un `File` puede tener 0..N vínculos (CA-13), y mientras esta columna siga existiendo en el
   * modelo su valor se copia del `File` en cada vínculo. Con la unicidad puesta, el segundo
   * vínculo del mismo archivo chocaría contra ella. No es un aflojamiento real: la migración
   * 20260819_05 YA DROPEÓ `storage_key` de `attachments`, así que la restricción solo existía
   * en el esquema que `sequelize.sync()` construye para los tests (ADR-013). Ninguna ruta de la
   * api depende de esa unicidad. La columna entera desaparece del modelo en S-004/S-005.
   */
  @Column({
    type: DataType.STRING(500),
    allowNull: false,
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

  /**
   * El archivo al que este vínculo apunta.
   *
   * NULLABLE en esta story a propósito: la migración 20260819_02 la agrega nullable y recién
   * 20260819_05 la endurece a NOT NULL. Hasta entonces las escrituras vigentes siguen
   * funcionando sin poblarla.
   */
  @ForeignKey(() => File)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    fileId!: number | null;

  @BelongsTo(() => File, { foreignKey: 'fileId', as: 'file' })
    file!: File | null;

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
