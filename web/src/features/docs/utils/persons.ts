export const UNKNOWN_PERSON = 'otra persona';

interface PersonLike {
  userId?: string | null;
  firstName: string;
  lastName: string;
}

/** Resuelve un `sub` de Zitadel contra las personas de Jiku; sin coincidencia, "otra persona". */
export const personName = (persons: readonly PersonLike[] | undefined, sub: string): string => {
  const person = persons?.find((p) => p.userId === sub);
  return person ? `${person.firstName} ${person.lastName}` : UNKNOWN_PERSON;
};
