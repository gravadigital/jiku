import {
  Table, Model, Column, DataType,
  ForeignKey, BelongsTo, HasMany
} from 'sequelize-typescript';
import User from './user.model';
import Attachment from './attachment.model';
import { RetentionStatus } from './retention-status.enum';

export enum ByteStatus {
  Pending = 'pending',
  Uploaded = 'uploaded',
}

/**
 * La identidad del archivo, independiente de a qué se vincule.
 *
 * Un `File` tiene 0..N `attachments`: puede existir sin estar vinculado a nada (lo que el
 * patrón draft resolvía antes de S-001) y puede tener varios vínculos.
 *
 * DIFERENCIAS DELIBERADAS RESPECTO DE `Attachment`, del que se copian los tipos:
 *
 * - NO lleva `@DefaultScope` que excluya `checksum`. El scope se aplica al armar la respuesta
 *   de `Attachment` en la api, así que replicarlo acá no aporta.
 * - NO lleva el `validate: { min, max }` de `fileSize`. El tope pasa a ser configurable por
 *   la clave `file-max-size-bytes`, y un máximo hardcodeado lo contradiría en cuanto alguien
 *   suba ese valor.
 *
 * `byteStatus` y `retentionStatus` se declaran `DataType.STRING`, NO `DataType.ENUM`, igual
 * que `Attachment` hace con `entityType`: declararlos ENUM haría que `sync()` cree tipos con
 * la convención de nombre de Sequelize (`enum_files_byte_status`), distintos de los que la
 * migración crea (`file_byte_status`), agravando la divergencia sync()<->migraciones.
 */
@Table({
  timestamps: true,
  tableName: 'files',
  underscored: true,
  paranoid: false,
})
export default class File extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    fileName!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
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

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
  })
    checksum!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: ByteStatus.Pending,
  })
    byteStatus!: ByteStatus;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    uploadedBy!: string;

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

  @HasMany(() => Attachment, { foreignKey: 'fileId', as: 'attachments' })
    attachments!: Attachment[];

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
