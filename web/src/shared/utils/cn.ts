type ClassValue = string | undefined | null | false | Record<string, boolean>;

export const cn = (...classes: ClassValue[]): string => {
  return classes
    .flatMap((cls) => {
      if (!cls) {
        return [];
      }
      if (typeof cls === 'string') {
        return [cls];
      }
      return Object.entries(cls)
        .filter(([, value]) => value)
        .map(([key]) => key);
    })
    .join(' ');
};
