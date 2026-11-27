import { Person, User, WorkedTime } from '@jiku/models';
import {Op} from 'sequelize';

export default async function findPersonsByMissingHoursInterval(start: Date, end: Date){
  const persons = await Person.findAll({
    where: {
      enabled: true,
      mustChargeWorkedTime: true,
    },
    order: [['id', 'ASC']],
    include: [
      {
        model: User,
        as: 'user',
        // Acotado por CA-12 de S-015: el default de Sequelize devuelve todas las columnas del
        // modelo, y `roles` / `identityType` no salen en ninguna respuesta HTTP. Hoy esta funcion
        // no tiene llamadores, asi que no hay respuesta donde filtre nada; se acota igual para
        // que no sea una trampa el dia que alguien la revive.
        attributes: ['id', 'name', 'email'],
      },
      {
        model: WorkedTime,
        as: 'workedTimes',
        required: false,
        where: {
          date: {
            [Op.between]: [start, end],
          },
        },
      },
    ],
  });
  return persons;
}
