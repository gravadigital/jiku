import React from 'react';
import { ObjectivesGroup, getObjectives } from '@/features/objectives';
import { ViewHeader } from '@/shared/components/ui';
import type { Objective, ObjectiveFilters } from '@/features/objectives';
import type { Person } from '@/shared/types';

interface PersonWithObjectives {
  objectives: Objective[];
  person: Person;
}

interface PersonMap {
  [key: string]: PersonWithObjectives;
}

export default async function Objectives() {
  const filters: ObjectiveFilters = {
    state: 'activo',
  };
  let objectives: Objective[] = [];
  try {
    objectives = await getObjectives(filters);
  } catch (error) {
    console.error(error);
  }

  objectives.sort((obj1: Objective, obj2: Objective) => {
    const dateA = obj1.estimatedFinishDate
      ? new Date(obj1.estimatedFinishDate).getTime()
      : Infinity;
    const dateB = obj2.estimatedFinishDate
      ? new Date(obj2.estimatedFinishDate).getTime()
      : Infinity;
    return dateA - dateB;
  });

  const personsMap: PersonMap = {};
  objectives.forEach((objective: Objective) => {
    objective.persons.forEach((person) => {
      if (!personsMap[person.id!.toString()]) {
        personsMap[person.id!.toString()] = {
          objectives: [],
          person,
        };
      }
      personsMap[person.id!.toString()].objectives.push(objective);
    });
  });
  const personsList: PersonWithObjectives[] = Object.keys(personsMap)
    .sort((key1, key2) => {
      const fullName1 = `${personsMap[
        key1
      ].person.firstName.toLowerCase()} ${personsMap[key1].person.lastName.toLowerCase()}`;
      const fullName2 = `${personsMap[
        key2
      ].person.firstName.toLowerCase()} ${personsMap[key2].person.lastName.toLowerCase()}`;
      if (fullName1 > fullName2) {
        return 1;
      }
      return -1;
    })
    .map((key) => {
      return personsMap[key];
    });

  return (
    <>
      <ViewHeader variant="list" title="Tareas por responsable" />
      <main>
        {personsList.map((person) => {
          const fullName = `${person.person.firstName}
           ${person.person.lastName}`;
          return (
            <ObjectivesGroup
              key={`objectives-group-person-${person.person.id}`}
              title={fullName}
              objectives={person.objectives}
              personId={person.person.id}
              showProject
            />
          );
        })}
      </main>
    </>
  );
}
