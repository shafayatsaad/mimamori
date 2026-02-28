import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isAppointmentPast } from '@/lib/appointment-utils';

describe('isAppointmentPast — appointment past/upcoming classification', () => {
  // Fixed "now" for deterministic tests: July 15, 2025 at 2:00 PM
  const now = new Date('2025-07-15T14:00:00');

  describe('unit tests', () => {
    it('classifies an ISO date in the past as past', () => {
      expect(isAppointmentPast({ date: '2025-01-01', time: '10:00 AM' }, now)).toBe(true);
    });

    it('classifies an ISO date in the future as upcoming', () => {
      expect(isAppointmentPast({ date: '2025-12-25', time: '10:00 AM' }, now)).toBe(false);
    });

    it('classifies short date format "Jan 1" in the past as past', () => {
      // Jan 1 of 2025 is before July 15, 2025
      expect(isAppointmentPast({ date: 'Jan 1', time: '10:00 AM' }, now)).toBe(true);
    });

    it('classifies short date format "Dec 25" in the future as upcoming', () => {
      // Dec 25 of 2025 is after July 15, 2025
      expect(isAppointmentPast({ date: 'Dec 25', time: '10:00 AM' }, now)).toBe(false);
    });

    it('handles today with past time as past', () => {
      // July 15 at 9:00 AM is before 2:00 PM
      expect(isAppointmentPast({ date: 'Jul 15, 2025', time: '9:00 AM' }, now)).toBe(true);
    });

    it('handles today with future time as upcoming', () => {
      // July 15 at 5:00 PM is after 2:00 PM
      expect(isAppointmentPast({ date: 'Jul 15, 2025', time: '5:00 PM' }, now)).toBe(false);
    });

    it('treats missing time as end of day (upcoming if same day)', () => {
      // Jul 15 with no time → 23:59:59 → still upcoming at 2:00 PM
      expect(isAppointmentPast({ date: 'Jul 15, 2025' }, now)).toBe(false);
    });

    it('treats missing date as upcoming (safe default)', () => {
      expect(isAppointmentPast({ date: '' }, now)).toBe(false);
    });

    it('treats invalid date string as upcoming (safe default)', () => {
      expect(isAppointmentPast({ date: 'not-a-date', time: '10:00 AM' }, now)).toBe(false);
    });

    it('handles PM time correctly', () => {
      expect(isAppointmentPast({ date: '2025-07-15', time: '1:00 PM' }, now)).toBe(true); // 1 PM < 2 PM
      expect(isAppointmentPast({ date: '2025-07-15', time: '3:00 PM' }, now)).toBe(false); // 3 PM > 2 PM
    });

    it('handles 12:00 AM (midnight) correctly', () => {
      expect(isAppointmentPast({ date: '2025-07-15', time: '12:00 AM' }, now)).toBe(true); // midnight < 2 PM
    });

    it('handles 12:00 PM (noon) correctly', () => {
      expect(isAppointmentPast({ date: '2025-07-15', time: '12:00 PM' }, now)).toBe(true); // noon < 2 PM
    });

    it('classifies appointment with full date string "Oct 24, 2024" as past', () => {
      expect(isAppointmentPast({ date: 'Oct 24, 2024', time: '10:00 AM' }, now)).toBe(true);
    });
  });

  describe('property-based tests', () => {
    /**
     * **Validates: Requirements 2.21**
     * For any appointment with a date clearly in the past, isAppointmentPast returns true.
     */
    it('appointments with ISO dates in the past are always classified as past', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 365 }),
          (daysAgo) => {
            const pastDate = new Date(now);
            pastDate.setDate(pastDate.getDate() - daysAgo);
            const isoDate = pastDate.toISOString().split('T')[0]; // YYYY-MM-DD
            expect(isAppointmentPast({ date: isoDate, time: '10:00 AM' }, now)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 2.21**
     * For any appointment with a date clearly in the future, isAppointmentPast returns false.
     */
    it('appointments with ISO dates in the future are always classified as upcoming', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 365 }),
          (daysAhead) => {
            const futureDate = new Date(now);
            futureDate.setDate(futureDate.getDate() + daysAhead);
            const isoDate = futureDate.toISOString().split('T')[0];
            expect(isAppointmentPast({ date: isoDate, time: '10:00 AM' }, now)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
