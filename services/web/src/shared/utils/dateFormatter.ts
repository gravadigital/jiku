export const labelFromDate = (date: Date, format: string): string => {
  const fullYear = date.getFullYear();
  const month = `0${date.getMonth() + 1}`.slice(-2);
  const day = `0${date.getDate()}`.slice(-2);
  let result = '';
  switch (format) {
    case 'YYYY-MM-DD':
      result = `${fullYear}-${month}-${day}`;
      break;
    case 'DD/MM':
      result = `${day}/${month}`;
      break;
    case 'DD/MM/YYYY':
      result = `${day}/${month}/${fullYear}`;
      break;
    default:
      break;
  }

  return result;
};
