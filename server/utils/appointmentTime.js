
import { DateTime } from "luxon";

export const SLOT_INTERVAL_MINUTES = 15;

export const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

export const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
};

// Convert clinic-local date and time into UTC.
export const localToUTC = (
  date,
  time,
  timezone
) => {
  const localDateTime = DateTime.fromISO(
    `${date}T${time}`,
    { zone: timezone }
  );

  if (!localDateTime.isValid) {
    throw new Error(
      `Invalid date, time or timezone: ${localDateTime.invalidExplanation}`
    );
  }

  return localDateTime.toUTC().toJSDate();
};

// Find weekday in clinic's timezone.
// Sunday = 0, Monday = 1, ... Saturday = 6.
export const getDayOfWeek = (date, timezone) => {
  const localDate = DateTime.fromISO(date, {
    zone: timezone,
  });

  if (!localDate.isValid) {
    throw new Error("Invalid date or timezone");
  }

  return localDate.weekday % 7;
};

// Current time as a UTC JavaScript Date.
export const getCurrentUTC = () => new Date();

// Check whether two time intervals overlap.
export const intervalsOverlap = (
  startA,
  endA,
  startB,
  endB
) => startA < endB && endA > startB;
