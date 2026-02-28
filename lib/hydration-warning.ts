/**
 * Pure function for determining whether a critical hydration warning should display.
 *
 * The warning fires when:
 *   consumed < goal * 0.25  AND  currentHour >= 14
 *
 * It never fires when consumed >= 25% of goal, and never fires before 2:00 PM.
 */
export function shouldShowHydrationWarning(
  consumed: number,
  goal: number,
  currentHour: number,
): boolean {
  if (goal <= 0) return false;
  return consumed < goal * 0.25 && currentHour >= 14;
}
