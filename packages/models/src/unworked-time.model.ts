import { Table, Model, Column, DataType, BelongsTo, ForeignKey } from 'sequelize-typescript';
import Person from './person.model';

export enum UnworkedReason {
  Tramite = 'tramite',
  CorteServicios = 'corte_servicios',
  Vacaciones = 'vacaciones',
  DiaNolaborable = 'dia_no_laborable',
  Personal = 'personal',
  Medico = 'medico',
  Estudio = 'estudio',
  Enfermedad = 'enfermedad',
  Otro = 'otro',
}

@Table({
  timestamps: true,
  tableName: 'unworked_times',
  underscored: true,
})

export default class UnworkedTime extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  })
    id!: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
    date!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    minutes!: number;

  @Column({
    type: DataType.ENUM(
      'tramite',
      'corte_servicios',
      'vacaciones',
      'dia_no_laborable',
      'personal',
      'medico',
      'estudio',
      'enfermedad',
      'otro'
    ),
    allowNull: false,
  })
    reason!: UnworkedReason;

  @ForeignKey(() => Person)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
    personId!: number;

  @BelongsTo(() => Person)
    person!: Person;
}
