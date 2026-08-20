import {
  Table, Model, Column, DataType,
  ForeignKey, BelongsTo, BeforeDestroy,
  Scopes
} from 'sequelize-typescript';
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
   * EN LA BASE ES `NOT NULL` desde la 20260819_05, pero acá sigue declarada nullable: la
   * columna nació nullable en la 20260819_02 y `link-files.ts` todavía tiene ramas explícitas
   * para el caso, comentadas como inalcanzables en producción. Endurecerla es correcto y está
   * pendiente; hacerlo obliga a retirar esas ramas en el mismo cambio.
   */
  @ForeignKey(() => File)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
    fileId!: number | null;

  @BelongsTo(() => File, { foreignKey: 'fileId', as: 'file' })
    file!: File | null;

  @BelongsTo(() => User, { foreignKey: 'deletedBy', as: 'deleter' })
    deleter!: User | null;

  /**
   * DESVINCULAR ES BORRAR LA FILA, y por eso este hook ya no bloquea el `destroy`.
   *
   * Hasta la 20260819_05 el borrado de un adjunto era lógico: `softDelete()` escribía
   * `retention_status` y `deleted_at` sobre `attachments`. Esa migración dropeó
   * `retention_status` de esta tabla —el ciclo de retención vive ahora en
   * `files.retention_status` (D-04)— así que `softDelete()` ya no tenía dónde escribir y se
   * eliminó junto con la columna.
   *
   * Se conserva el `force: true` como requisito explícito: un `destroy` sin él es casi
   * siempre un descuido, y pedirlo obliga a escribir "sí, borrá la fila" en el call site.
   * `core/src/commands/link-files.ts` y `attachments/attachments-delete.ts` ya lo pasan.
   */
  @BeforeDestroy
  static requireForce(_attachment: Attachment, options: any) {
    if (!options.force) {
      throw new Error(
        'Desvincular borra la fila: pasá `force: true` explícitamente.'
      );
    }
  }
}
