import { Table, Model, Column, DataType, HasMany, HasOne } from 'sequelize-typescript';
import ObjectiveActivity from './objective-activity.model';
import Objective from './objectives.model';
import Project from './project.model';
import Person from './person.model';

export enum IdentityType {
  Person = 'person',
  Service = 'service',
}

/**
 * Espejo de la identidad que provee Zitadel. El `id` es el `sub`.
 *
 * `identityType` distingue a una persona de una identidad de servicio, y `roles` guarda los
 * roles tal como vienen del proveedor de identidad, sin validar contra ningún catálogo: la
 * autorización no sale de esta lista por sí misma, sale de compararla contra un mapa cerrado y
 * deny-by-default. Los dos valores del enum están en inglés porque no los elige el producto ni
 * viajan al front: son el `type` de `deploy/nats/auth-callout/rules.yaml`.
 *
 * `identityType` se declara `DataType.STRING`, NO `DataType.ENUM`, igual que `byteStatus` y
 * `retentionStatus` de `File`: declararlo ENUM haría que `sync()` cree el tipo con la
 * convención de nombre de Sequelize (`enum_users_identity_type`), distinto del `identity_type`
 * que crea la migración, y las dos fuentes del esquema divergirían sin que ningún test lo vea.
 * El precedente está documentado en `docs/db-schemas/jiku.md` (`byte_status` /
 * `retention_status`).
 */
@Table({
  timestamps: true,
  tableName: 'users',
  underscored: true,
})

export default class User extends Model {
  @Column({
    type: DataType.STRING(100),
    primaryKey: true,
  })
    id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    username!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
    email!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
    roles!: string[];

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: IdentityType.Person,
  })
    identityType!: IdentityType;

  @HasMany(() => ObjectiveActivity)
    ObjectiveActivity!: ObjectiveActivity[];

    @HasMany(() => Project)
      projects!: Project[];

  @HasMany(() => Objective)
    objectives!: Objective[];

  @HasOne(() => Person)
    person!: Person;
}
