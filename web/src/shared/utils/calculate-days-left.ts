/**
 * Acepta `string` además de `Date` por el mismo motivo que `formatDate`: la api serializa las
 * fechas y los tipos de dominio de `web`, escritos a mano, las declaran `Date`.
 */
export const calculateDaysLeft = (date: Date | string): number => {
  const currentDate = new Date();
  const parsed = date instanceof Date ? date : new Date(date);
  let daysLeft = 0;

  const normalizedCurrentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const normalizedTargetDate = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );

  if (normalizedCurrentDate.getTime() < normalizedTargetDate.getTime()) {
    const tempDate = new Date(normalizedCurrentDate.getTime());

    while (tempDate.getTime() < normalizedTargetDate.getTime()) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysLeft += 1;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
  } else if (normalizedCurrentDate.getTime() > normalizedTargetDate.getTime()) {
    const tempDate = new Date(normalizedTargetDate.getTime());

    while (tempDate.getTime() < normalizedCurrentDate.getTime()) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysLeft -= 1;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  return daysLeft;
};
