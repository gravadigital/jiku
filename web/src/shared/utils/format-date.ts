export const formatDate = (date: Date | null | undefined): string => {
  if (!date || isNaN(date.getTime())) {
    return 'N / D';
  }
  const day = date.toUTCString().slice(5, 7);
  const month = date.toUTCString().slice(8, 11);
  return `${day} ${month}`;
};
