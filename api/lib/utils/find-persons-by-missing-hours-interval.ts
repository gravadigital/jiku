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
