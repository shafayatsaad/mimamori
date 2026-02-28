/**
 * Determine if an appointment is in the past by comparing its date+time against now.
 * Handles formats: ISO strings, "Oct 24, 2025", "Jan 1", etc.
 */
export function isAppointmentPast(appt: { date: string; time?: string }, now?: Date): boolean {
  const currentTime = now ?? new Date();
  const dateStr = appt.date?.trim();
  if (!dateStr) return false; // No date → treat as upcoming

  let parsed: Date | null = null;

  // Try parsing the date string directly (handles ISO and full date strings like "Oct 24, 2025")
  const directParse = new Date(dateStr);
  if (!isNaN(directParse.getTime())) {
    // Check if the parsed year is reasonable (within ~2 years of current time)
    // This avoids treating "Dec 25" → Dec 25, 2001 as a valid full date
    const yearDiff = Math.abs(directParse.getFullYear() - currentTime.getFullYear());
    if (yearDiff <= 2) {
      parsed = directParse;
    }
  }

  // If direct parse didn't yield a reasonable date, try short format with current year
  if (!parsed) {
    // Validate the string looks like a month-day pattern before appending year
    const monthDayPattern = /^[A-Za-z]{3,9}\s+\d{1,2}$/;
    if (monthDayPattern.test(dateStr)) {
      const withYear = `${dateStr}, ${currentTime.getFullYear()}`;
      const yearParse = new Date(withYear);
      if (!isNaN(yearParse.getTime())) {
        parsed = yearParse;

        // If the parsed date is in the future by more than 6 months, it likely refers to last year
        const sixMonthsFromNow = new Date(currentTime);
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        if (parsed > sixMonthsFromNow) {
          parsed.setFullYear(parsed.getFullYear() - 1);
        }
      }
    }
  }

  // Still no valid date → treat as upcoming (safe default)
  if (!parsed) return false;

  // Apply time if provided (e.g., "10:00 AM", "2:30 PM")
  const timeStr = appt.time?.trim();
  if (timeStr) {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const period = timeMatch[3]?.toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      parsed.setHours(hours, minutes, 0, 0);
    }
  } else {
    // No time provided — treat end of day as the cutoff
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed < currentTime;
}
