import {
  Table, Model, Column, DataType, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import User from './user.model';

/**
 * Cola de salida de notificaciones. Cada fila es un hecho ya congelado (destinatario, correo y
 * payload) a la espera de que el proceso de envío (S-073) lo despache.
 *
 * `type` y `status` se declaran `DataType.STRING`, NUNCA `DataType.ENUM`: un ENUM haría que
 * `sync()` cree un tipo con la convención de nombre de Sequelize
 * (`enum_notification_outbox_status`), distinto del que produciría una migración, agravando la
 * divergencia entre `sync()` (testing/development) y las migraciones (producción) que ADR-005 ya
 * declara como riesgo sin mitigar. Y contradiría el objetivo del REQ: agregar un tipo de
 * notificación nuevo tiene que ser sumar una fila al registro de código, no un `ALTER TYPE`
 * (que en PostgreSQL ni siquiera es reversible dentro de una transacción). Mismo precedente que
 * `identity_type` en `user.model.ts` y `byte_status`/`retention_status` en `file.model.ts`.
 *
 * No hay ningún `unique` de idempotencia (ni en columnas ni en `indexes`). La entrega es
 * at-least-once por decisión de producto (RF-25): la ventana de duplicado está entre el `send`
 * y el `UPDATE`, no en el `INSERT`. Un unique sobre `(type, recipientUserId, ...)` prometería
 * exactly-once sin darlo, y rompería el caso legítimo de dos comentarios seguidos del mismo autor
 * sobre el mismo requisito.
 *
 * `updatedAt: false`: la forma de la tabla (CA-1) tiene `created_at` pero no `updated_at`. Con
 * `timestamps: true` a secas, `sync()` agregaría una columna que la migración de `api` no crea,
 * y las dos fuentes del esquema divergirían. Mismo precedente que `inbound-mail-thread.model.ts`.
 */
@Table({
  timestamps: true,
  updatedAt: false,
  tableName: 'notification_outbox',
  underscored: true,
  indexes: [
    {
      name: 'idx_notification_outbox_pending',
      fields: ['next_attempt_at', 'id'],
      where: { status: 'pending' },
    },
  ],
})
export default class NotificationOutbox extends Model {
  // BIGINT, no INTEGER: es una tabla de flujo que crece con cada hecho notificado. El driver
  // `pg` devuelve los BIGINT de PostgreSQL como string (exceden el entero seguro de
  // JavaScript), y Sequelize no los convierte: por eso se tipa `string`, no `number`.
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  })
    id!: string;

  // Clave del registro de tipos (S-071). Nunca texto libre.
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    type!: string;

  // Única concesión al multicanal: hoy solo existe 'email', pero la columna no lo asume.
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'email',
  })
    channel!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
    recipientUserId!: string;

  // Congelado al encolar: un destinatario sin correo no llega a escribirse.
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
    recipientEmail!: string;

  // Datos del mail, congelados al encolar. La forma concreta la fija el registro de tipos de
  // S-071; acá se tipa de la forma mínima honesta para no anticiparla.
  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
    payload!: Record<string, unknown>;

  // 'pending' / 'sent'. No hay 'failed': tras el máximo de intentos la fila se borra.
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
  })
    status!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
    attempts!: number;

  // DataType.NOW (no `new Date()`): `new Date()` se evaluaría una sola vez al importar el
  // módulo y congelaría el valor para todas las filas. DataType.NOW hace que `sync()` emita
  // `DEFAULT NOW()`, evaluado por PostgreSQL en cada INSERT.
  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
    nextAttemptAt!: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
    lastError!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
    sentAt!: Date | null;

  @BelongsTo(() => User)
    recipient!: User;
}
