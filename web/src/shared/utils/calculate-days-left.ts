export const calculateDaysLeft = (date: Date): number => {
  const currentDate = new Date();
  let daysLeft = 0;

  const normalizedCurrentDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const normalizedTargetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

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
