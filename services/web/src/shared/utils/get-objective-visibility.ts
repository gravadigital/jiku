export const getObjectiveVisibility = (visibility: string): string => {
  const visibilityMap: { [key: string]: string } = {
    internal: 'Interno',
    public: 'Público',
  };
  return visibilityMap[visibility] || visibility;
};
