'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import {
  calculateProgressRatio,
  isGoalReached,
  shouldShowLowHydrationWarning,
  validateIntakeAmount,
  computeHydrationAggregates,
} from '@/lib/hydration';
import { shouldShowHydrationWarning } from '@/lib/hydration-warning';

export default function HydrationCard() {
  const {
    intakeLogs,
    hydrationGoal,
    hydrationTemperature,
    hydrationLoading,
    addIntakeLog,
    correctIntakeTotal,
    totalConsumed,
    currentUserType,
    locationError,
    fetchWeatherByLocation,
    hydrationPresets,
    intakeBounds,
    cityPresets,
  } = useAppContext();

  const [customAmount, setCustomAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [editedTotal, setEditedTotal] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);

  const { logCount } = computeHydrationAggregates(intakeLogs);
  const progressRatio = calculateProgressRatio(totalConsumed, hydrationGoal);
  const goalReached = isGoalReached(totalConsumed, hydrationGoal);
  const currentHour = new Date().getHours();
  const isCaregiver = currentUserType === 'Caregiver';
  const showLowWarning = shouldShowLowHydrationWarning(
    totalConsumed,
    hydrationGoal,
    currentHour,
    currentUserType ?? '',
  );
  const showCriticalWarning = shouldShowHydrationWarning(totalConsumed, hydrationGoal, currentHour);
  const isUsingDefaultGoal = hydrationTemperature === null;

  const presetAmounts = hydrationPresets;

  const handlePresetClick = async (amount: number) => {
    await addIntakeLog(amount);
  };

  const handleCustomSubmit = async () => {
    const amount = Number(customAmount);
    if (!validateIntakeAmount(amount, { min: intakeBounds.min, max: intakeBounds.max })) {
      setValidationError(`Enter ${intakeBounds.min}–${intakeBounds.max} mL`);
      return;
    }
    setValidationError(null);
    await addIntakeLog(amount);
    setCustomAmount('');
  };

  const handleCitySelect = async (lat: number, lon: number) => {
    setIsSubmittingLocation(true);
    await fetchWeatherByLocation(lat, lon);
    setIsSubmittingLocation(false);
  };

  const handleRetryGeolocation = async () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsSubmittingLocation(true);
      setGeoError(null);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        await fetchWeatherByLocation(position.coords.latitude, position.coords.longitude);
      } catch (err: any) {
        console.error('Geolocation failed:', err);
        let errMsg = 'Location permission denied or timed out.';
        if (err.code === 1) errMsg = 'Location permission denied by browser settings. Please allow location access in your URL bar.';
        if (err.code === 2) errMsg = 'Location position is unavailable.';
        if (err.code === 3) errMsg = 'Location request timed out. Please try again.';
        setGeoError(errMsg);
      }
      setIsSubmittingLocation(false);
    } else {
      setGeoError('Geolocation is not supported by your browser.');
    }
  };

  const progressPercent = Math.min(progressRatio * 100, 100);

  // Loading skeleton
  if (hydrationLoading) {
    return (
      <div className="glass-card rounded-[2rem] p-6 flex flex-col animate-pulse">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        <div className="h-7 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-2 w-full bg-gray-100 rounded-full" />
      </div>
    );
  }

  // Location required — show prompt
  if (locationError && hydrationTemperature === null) {
    return (
      <div className="glass-card rounded-[2rem] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location Needed</span>
        </div>

        <p className="text-xs font-semibold text-gray-600 mb-4 leading-relaxed">
          Enable location for weather-based hydration goals
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {cityPresets.map((city) => (
            <button
              key={city.name}
              onClick={() => handleCitySelect(city.lat, city.lon)}
              disabled={isSubmittingLocation}
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border border-blue-100 disabled:opacity-50"
            >
              {city.name}
            </button>
          ))}
        </div>

        {geoError && (
          <p className="text-red-500 text-[10px] font-bold mb-3 text-center bg-red-50 border border-red-100 rounded-lg p-2">
            ⚠️ {geoError}
          </p>
        )}

        <button
          onClick={handleRetryGeolocation}
          disabled={isSubmittingLocation}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
        >
          {isSubmittingLocation ? 'Getting location...' : 'Allow Location'}
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[2rem] p-6 flex flex-col relative group">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-400/20 group-hover:scale-110 transition-transform flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hydrationTemperature !== null && (
            <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded-md text-[10px] font-bold">{hydrationTemperature}°C</span>
          )}
          {goalReached && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5"
              data-testid="goal-reached-indicator"
            >
              ✓ 🎉
            </motion.span>
          )}
        </div>
      </div>

      {/* Low-hydration warning */}
      {showLowWarning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-lg mb-3 flex items-center gap-1.5"
          data-testid="low-hydration-warning"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
          </svg>
          Below 50% of daily goal
        </motion.div>
      )}

      {/* Critical hydration warning — <25% of goal after 2 PM */}
      {showCriticalWarning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-300 text-red-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg mb-3 flex items-center gap-1.5"
          data-testid="critical-hydration-warning"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
          </svg>
          Dangerously low hydration — drink water now
        </motion.div>
      )}

      {/* Amount display — click to edit */}
      <div className="mb-1">
        {isEditingTotal && !isCaregiver ? (
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              autoFocus
              value={editedTotal}
              onChange={e => setEditedTotal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const newTotal = Math.max(0, Math.round(Number(editedTotal)));
                  if (!isNaN(newTotal) && newTotal !== totalConsumed) {
                    correctIntakeTotal(newTotal);
                  }
                  setIsEditingTotal(false);
                } else if (e.key === 'Escape') {
                  setIsEditingTotal(false);
                }
              }}
              onBlur={() => {
                const newTotal = Math.max(0, Math.round(Number(editedTotal)));
                if (!isNaN(newTotal) && newTotal !== totalConsumed) {
                  correctIntakeTotal(newTotal);
                }
                setIsEditingTotal(false);
              }}
              className="max-w-[60%] text-3xl font-black text-gray-900 tracking-tight leading-none bg-blue-50 border border-blue-200 rounded-xl px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={0}
              aria-label="Edit total consumed"
            />
            <span className="text-xs font-bold text-gray-400">mL</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <button
              onClick={() => {
                if (!isCaregiver) {
                  setEditedTotal(String(totalConsumed));
                  setIsEditingTotal(true);
                }
              }}
              className={`text-3xl font-black text-gray-900 tracking-tight leading-none ${!isCaregiver ? 'hover:text-blue-600 cursor-text transition-colors' : ''}`}
              title={!isCaregiver ? 'Click to adjust' : undefined}
              aria-label={!isCaregiver ? 'Click to edit total consumed' : 'Total consumed'}
            >
              {totalConsumed}
            </button>
            <span className="text-xs font-bold text-gray-400">mL</span>
          </div>
        )}
        <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
          of {hydrationGoal} mL · {logCount} {logCount === 1 ? 'log' : 'logs'}
        </p>
      </div>

      {/* Circular-style progress bar */}
      <div className="my-3" data-testid="progress-bar">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${goalReached ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] font-bold text-gray-300">{Math.round(progressPercent)}%</span>
          <span className="text-[9px] font-bold text-gray-300">{hydrationGoal} mL</span>
        </div>
      </div>

      {/* Quick-add controls — hidden for caregivers and when goal is reached */}
      {!isCaregiver && !goalReached && (
        <>
          {/* Preset buttons row */}
          <div className="flex gap-1.5 mb-2">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => handlePresetClick(amount)}
                className="flex-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 py-1.5 rounded-xl text-[11px] font-bold transition-all border border-blue-100/80"
                data-testid={`preset-btn-${amount}`}
              >
                +{amount}
              </button>
            ))}
          </div>

          {/* Custom input — toggled */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors py-1"
          >
            {expanded ? 'Close' : 'Custom amount...'}
          </button>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 mt-1"
            >
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setValidationError(null);
                }}
                placeholder="mL"
                min={intakeBounds.min}
                max={intakeBounds.max}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white/80 transition-all"
                data-testid="custom-intake-input"
              />
              <button
                onClick={handleCustomSubmit}
                className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                data-testid="custom-intake-submit"
              >
                Add
              </button>
            </motion.div>
          )}

          {validationError && (
            <p className="text-red-500 text-[10px] font-bold mt-1" data-testid="validation-error">
              {validationError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
