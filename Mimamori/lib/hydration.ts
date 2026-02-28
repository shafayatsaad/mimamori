/**
 * Hydration utility functions for dynamic hydration goal calculation,
 * intake validation, and progress tracking.
 *
 * All threshold/bound/warning functions accept optional config objects.
 * When no config is provided, defaults are loaded from Config_Service.
 */

import { getConfig } from '@/lib/config-service';

/** A single record of water consumption logged by a patient. */
export interface IntakeLog {
  id: string;
  amount: number;      // milliliters
  timestamp: string;   // ISO 8601
  date: string;        // YYYY-MM-DD
}

/**
 * Calculates the daily hydration goal based on current temperature.
 * When no config is provided, uses defaults from Config_Service.
 *   > hotTemp  → hotGoalMl
 *   warmTemp–hotTemp (inclusive) → warmGoalMl
 *   < warmTemp  → coldGoalMl
 */
export function calculateHydrationGoal(
  temperature: number,
  config?: { hotTemp: number; warmTemp: number; hotGoalMl: number; warmGoalMl: number; coldGoalMl: number },
): number {
  const { hotTemp, warmTemp, hotGoalMl, warmGoalMl, coldGoalMl } = config ?? getConfig().hydration;
  if (temperature > hotTemp) return hotGoalMl;
  if (temperature >= warmTemp) return warmGoalMl;
  return coldGoalMl;
}

/**
 * Returns true if the intake amount is within the configured bounds.
 * When no bounds are provided, uses defaults from Config_Service.
 */
export function validateIntakeAmount(
  amount: number,
  bounds?: { min: number; max: number },
): boolean {
  const { min, max } = bounds ?? {
    min: getConfig().hydration.intakeMinMl,
    max: getConfig().hydration.intakeMaxMl,
  };
  return Number.isFinite(amount) && amount >= min && amount <= max;
}

/**
 * Computes aggregate hydration data from a list of intake logs.
 */
export function computeHydrationAggregates(
  logs: IntakeLog[],
): { totalConsumed: number; logCount: number } {
  return {
    totalConsumed: logs.reduce((sum, log) => sum + log.amount, 0),
    logCount: logs.length,
  };
}

/**
 * Returns the progress ratio (consumed / goal), clamped to [0, 1].
 */
export function calculateProgressRatio(consumed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.max(consumed / goal, 0), 1);
}

/**
 * Returns true when a low-hydration warning should be shown.
 * When no params are provided, uses defaults from Config_Service.
 *   userType is 'Caregiver' AND currentHour >= triggerHour AND consumed < goal * (percentThreshold / 100)
 */
export function shouldShowLowHydrationWarning(
  consumed: number,
  goal: number,
  currentHour: number,
  userType: string,
  params?: { triggerHour: number; percentThreshold: number },
): boolean {
  const { triggerHour, percentThreshold } = params ?? {
    triggerHour: getConfig().hydration.lowHydrationHour,
    percentThreshold: getConfig().hydration.lowHydrationPercent,
  };
  return userType === 'Caregiver' && currentHour >= triggerHour && consumed < goal * (percentThreshold / 100);
}

/**
 * Returns true when the consumed amount meets or exceeds the goal.
 */
export function isGoalReached(consumed: number, goal: number): boolean {
  return consumed >= goal;
}
