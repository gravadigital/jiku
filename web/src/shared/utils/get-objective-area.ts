export const getObjectiveArea = (area: string): string => {
  const areaMap: { [key: string]: string } = {
    desarrollo: 'Desarrollo',
    diseño: 'Diseño',
    gestion: 'Gestión',
    investigacion: 'Investigación',
  };
  return areaMap[area] || area;
};
