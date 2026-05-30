'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import HydrationCard from '@/components/HydrationCard';
import { useTranslations } from 'next-intl';
import { detectCriticalBP } from '@/lib/critical-alerts';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { storageKey } from '@/lib/storage-keys';

export default function DashboardHomePage() {
  const { currentUserType, currentCaregiverId, caregivers, patientProfile, patientEmail, logs, documents, syncFailed, invitations, hydrationTemperature, hydrationGoal, locationError, aiGenerations, setAIGeneration, getGenerationTriggerHash, cityPresets, fetchWeatherByLocation } = useAppContext();
  const t = useTranslations('dashboard');
  const todayKey = storageKey(`medTaken_${new Date().toISOString().slice(0, 10)}`);
  const [medTaken, setMedTaken] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(todayKey) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(todayKey, String(medTaken));
  }, [medTaken, todayKey]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [insightError, setInsightError] = useState(false);
  const [insightErrorMsg, setInsightErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sharingInsight, setSharingInsight] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleAutoDetectLocation = async () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setDetectingLocation(true);
      setGeoError(null);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 30000,
            maximumAge: 60000
          });
        });
        await fetchWeatherByLocation(position.coords.latitude, position.coords.longitude);
        showToast('Location updated successfully!');
      } catch (err: any) {
        console.error('Geolocation failed in dashboard:', err);
        let errMsg = 'Location permission denied or timed out.';
        if (err.code === 1) errMsg = 'Location permission denied. Please allow location access in your URL bar.';
        if (err.code === 2) errMsg = 'Location position is unavailable.';
        if (err.code === 3) errMsg = 'Location request timed out. Please try again.';
        setGeoError(errMsg);
        showToast(errMsg);
      } finally {
        setDetectingLocation(false);
      }
    } else {
      setGeoError('Geolocation is not supported by your browser.');
      showToast('Geolocation is not supported.');
    }
  };


  // Combine all log sources: text, transcript, probes, and probe answers
  const unitedLogs = logs.map(l => {
    const parts = [l.text, l.transcript || ''];
    if (l.probes) parts.push(...l.probes);
    if (l.probeAnswers) parts.push(...l.probeAnswers.map(pa => `${pa.title}: ${pa.answer}`));
    return parts.join(' ');
  }).join(' ');
  const bpMatch = unitedLogs.match(/(\d{2,3})\/(\d{2,3})/);
  const bpString = bpMatch ? `${bpMatch[1]}/${bpMatch[2]}` : null;
  const bpClassification = detectCriticalBP(bpString);

  const sleepMatch = unitedLogs.match(/(\d+)\s*(?:hours|hr|hrs|h)\s*(?:(\d+)\s*(?:minutes|mins|min|m))?/i);
  const sleepString = sleepMatch ? `${sleepMatch[1]}h ${sleepMatch[2] || '0'}m` : null;

  // For meds, try to find any mention of "mg" in the logs
  const medMatch = unitedLogs.match(/([a-zA-Z]+)\s+(\d+)\s*mg/i);
  const recentMed = medMatch ? `${medMatch[1]} (${medMatch[2]}mg)` : null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShareInsight = async () => {
    if (!aiInsight || sharingInsight) return;

    // Collect caregiver emails from invitations
    const caregiverEmails = invitations
      .map(inv => inv.email)
      .filter(email => email && email.trim() !== '');

    if (caregiverEmails.length === 0) {
      showToast('No caregivers with email addresses found.');
      return;
    }

    setSharingInsight(true);
    try {
      const results = await Promise.all(
        caregiverEmails.map(email =>
          fetchWithRetry('/api/send-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, message: aiInsight }),
          }, { maxRetries: 1, delayMs: 1000 })
        )
      );

      const allSucceeded = results.every(res => res.ok);
      if (allSucceeded) {
        showToast('Insight shared with your care team');
      } else {
        showToast('Failed to share insight. Please try again.');
      }
    } catch {
      showToast('Failed to share insight. Please try again.');
    } finally {
      setSharingInsight(false);
    }
  };

  const handleCheckIn = async () => {
    if (checkingIn || !patientEmail) return;

    setCheckingIn(true);
    try {
      const res = await fetchWithRetry('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: patientEmail,
          message: `Your caregiver ${caregiver?.name ?? 'your caregiver'} is checking in on you. They want you to know they are thinking of you!`,
        }),
      }, { maxRetries: 1, delayMs: 1000 });

      if (res.ok) {
        showToast('Check-in message sent');
      } else {
        showToast('Failed to send check-in. Please try again.');
      }
    } catch {
      showToast('Failed to send check-in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  // Track whether we've already fetched insight to avoid re-fetching on every context update
  const insightFetchedRef = useRef(false);

  // Restore persisted AI insight on mount
  useEffect(() => {
    const cached = aiGenerations['default-analysis'];
    if (cached) {
      setAiInsight(cached.content);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchInsight() {
      if (logs.length === 0) return;

      const currentHash = getGenerationTriggerHash();
      const cached = aiGenerations['default-analysis'];

      // If we have a cached generation and the trigger hash hasn't changed, skip
      if (cached && cached.triggerHash === currentHash) {
        if (!aiInsight) setAiInsight(cached.content);
        return;
      }

      if (insightFetchedRef.current) return;
      insightFetchedRef.current = true;
      setIsGenerating(true);
      setInsightError(false);
      setInsightErrorMsg(null);
      try {
        const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));

        const res = await fetchWithRetry('/api/medical-reasoning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            logs: logs.slice(0, 5),
            documents: analyzedDocs,
            promptType: 'default-analysis'
          }) 
        }, { maxRetries: 1, delayMs: 1000 });
        const data = await res.json();
        if (res.ok && data.insight) {
          setAiInsight(data.insight);
          setAIGeneration('default-analysis', data.insight, currentHash);
        } else {
          setInsightError(true);
          setInsightErrorMsg(data.error || 'Failed to generate AI content');
          // Allow retry on next mount if it failed
          insightFetchedRef.current = false;
        }
      } catch (err) {
        console.error('Failed to parse AI medical reasoning', err);
        setInsightError(true);
        setInsightErrorMsg((err as Error).message || 'Failed to generate AI content');
        // Allow retry on next mount if it failed
        insightFetchedRef.current = false;
      } finally {
        setIsGenerating(false);
      }
    }
    fetchInsight();
  }, [logs, documents]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCaregiver = currentUserType === 'Caregiver';
  const caregiver = isCaregiver ? caregivers.find(c => c.id === currentCaregiverId) : null;

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-6xl mx-auto relative pb-6 min-w-0">
      {toastMessage && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--color-brand-green)] text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm z-50 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {toastMessage}
        </motion.div>
      )}

      {/* Sync Failure Banner */}
      <AnimatePresence>
        {syncFailed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 flex-shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Sync failed — your data is saved locally
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start mb-10 gap-4">
        <div className="min-w-0">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3"
          >
            {t('greeting', { name: isCaregiver ? (caregiver?.selfName || caregiver?.name || '').split(' ')[0] : patientProfile.name.split(' ')[0] })}
            <span className="text-2xl animate-bounce origin-bottom">👋</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-400 font-bold mt-2 text-sm tracking-wide"
          >
            {isCaregiver ? t('subtitleCaregiver', { name: patientProfile.name }) : t('subtitlePatient')}
          </motion.p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {!isCaregiver && caregivers.length > 0 && (
            <div className="hidden sm:flex bg-orange-50/50 border border-orange-200 text-orange-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider items-center gap-2 shadow-sm">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
              Caregiver: Active
            </div>
          )}
        </div>
      </div>

      {/* Main AI Prediction Card / Caregiver Alert */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
        className={`rounded-[2rem] p-8 md:p-10 mb-8 flex flex-col relative overflow-hidden ${isCaregiver ? 'bg-orange-50/80 border border-orange-200' : 'glass-card'}`}
      >
        <div className="flex items-center gap-3 mb-6">
           <div className={`flex items-center gap-1 ${isCaregiver ? 'text-red-500' : 'text-orange-500'}`}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               {isCaregiver ? (
                 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>
               ) : (
                 <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></>
               )}
             </svg>
           </div>
           <span className={`text-[10px] font-bold uppercase tracking-widest ${isCaregiver ? 'text-red-600' : 'text-gray-400'}`}>
             {isCaregiver ? t('caregiverAlertLabel') : t('aiInsightLabel')}
           </span>
        </div>

        <h2 className={`text-2xl md:text-[28px] font-medium leading-snug mb-10 max-w-3xl text-balance ${isCaregiver ? 'text-red-900' : 'text-gray-800'}`}>
          {logs.length === 0 ? (
            <span className={isCaregiver ? 'text-orange-800/60' : 'text-gray-400 font-medium'}>
              {isCaregiver ? t('logFirstEntryCaregiver', { name: patientProfile.name.split(' ')[0] }) : t('logFirstEntry')}
            </span>
          ) : isGenerating ? (
             <span className="flex items-center gap-3">
               <svg className="animate-spin h-6 w-6 flex-shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               <span className={`animate-pulse ${isCaregiver ? 'text-orange-800/60' : 'text-gray-400'}`}>{t('analyzing')}</span>
             </span>
          ) : aiInsight ? (
             <div>
               {aiInsight.split(/\n\n|\n/).filter(p => p.trim()).map((paragraph, i) => (
                 <p key={i} className="mb-2">{paragraph.trim()}</p>
               ))}
             </div>
          ) : (
             <span className={isCaregiver ? 'text-orange-800/60' : 'text-red-500 font-medium text-base md:text-lg block border border-red-100 bg-red-50/50 rounded-2xl p-4 md:p-6'}>
               ⚠️ {insightErrorMsg || t('insightError')}
             </span>
          )}
        </h2>

        {aiInsight && !isGenerating && logs.length > 0 && (
          <p className="text-[11px] text-gray-400 italic -mt-6 mb-6">
            AI-generated — not a clinical assessment. Verify with your care team.
          </p>
        )}

        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 rounded-2xl border gap-6 ${isCaregiver ? 'bg-white border-orange-100 shadow-sm' : 'bg-gray-50/50 border-gray-100/80'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 ${logs.length === 0 ? 'bg-gray-100 text-gray-400' : isCaregiver ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15 10a5 5 0 0 0-10 0c0 2 1 4 3 5 0 2 .5 3 2 3h4c1.5 0 2-1 2-3 2-1 3-3 3-5"></path></svg>
            </div>
            <div>
              <p className={`text-[12px] font-bold uppercase tracking-wider mb-1 ${isCaregiver ? 'text-red-800' : 'text-gray-900'}`}>{t('recommendedPrecaution')}</p>
              <p className={`text-sm font-medium ${isCaregiver ? 'text-red-600/80' : 'text-gray-600'}`}>{logs.length === 0 ? t('unlockRecommendations') : t('defaultPrecaution')}</p>
            </div>
          </div>
          {!isCaregiver && logs.length > 0 && (
            <button 
              onClick={handleShareInsight}
              disabled={sharingInsight || !aiInsight}
              className="bg-[#d1fae5] hover:bg-[#a7f3d0] text-[#059669] px-4 py-2 rounded-full text-xs font-bold transition-colors shadow-sm text-shadow-sm flex items-center gap-1 border border-[#a7f3d0] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharingInsight ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              )}
              {sharingInsight ? 'Sharing...' : 'Share with Care Team'}
            </button>
          )}
          {isCaregiver && logs.length > 0 && (
            <button 
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-full text-xs font-bold transition-colors shadow-sm text-shadow-sm flex items-center gap-1 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingIn ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              )}
              {checkingIn ? 'Sending...' : 'Check In'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Metrics Row */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        {/* Blood Pressure */}
        <div className={`glass-card rounded-[2rem] p-6 flex flex-col justify-between h-56 ${
          bpClassification === 'crisis' ? 'border-2 border-red-500' :
          bpClassification === 'low' ? 'border-2 border-amber-500' : ''
        }`}>
          <div className="flex justify-between items-center">
             <div className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             </div>
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('bloodPressure')}</span>
          </div>
          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-gray-900 tracking-tight">{bpString || "--"}</span>
              {bpString && <span className="text-sm font-bold text-gray-400">mmHg</span>}
            </div>
            {bpString && (
              <p className="text-[10px] text-gray-400 mb-2">Estimated from your logs — verify with your care team</p>
            )}
            {bpClassification === 'crisis' && (
              <p className="text-[11px] font-bold text-red-600 mb-2">Critical BP — contact your care team immediately</p>
            )}
            {bpClassification === 'low' && (
              <p className="text-[11px] font-bold text-amber-600 mb-2">Low BP detected — consult your care team</p>
            )}
            {bpString ? (
              <span className="inline-block bg-red-50 text-red-600 px-2 py-0.5 rounded text-[11px] font-bold">{t('loggedToday')}</span>
            ) : (
              <span className="inline-block bg-gray-50 text-gray-400 px-2 py-0.5 rounded text-[11px] font-bold">{t('noRecentLogs')}</span>
            )}
          </div>
        </div>

        {/* Next Dose */}
        <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between h-56">
          <div className="flex justify-between items-center">
             <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 19 12a3.53 3.53 0 0 0-5-5l-8.5 8.5a3.53 3.53 0 0 0 5 5z"></path><line x1="10.5" y1="13.5" x2="15.5" y2="8.5"></line><path d="M14 2h6v6"></path><path d="M12.5 10.5 20 3"></path></svg>
             </div>
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('nextDose')}</span>
          </div>
          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-gray-900 tracking-tight capitalize">{recentMed || "--"}</span>
            </div>
            {recentMed && (
              <p className="text-[10px] text-gray-400 mb-2">Estimated from your logs — verify with your care team</p>
            )}
            {recentMed ? (
              !isCaregiver ? (
                <button 
                  onClick={() => setMedTaken(!medTaken)}
                  className={`w-full font-bold py-2.5 rounded-xl transition-all text-sm shadow-sm border ${
                    medTaken 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-[#f4f7fa] hover:bg-blue-50 text-blue-600 border-transparent hover:border-blue-100'
                  }`}
                >
                  {medTaken ? t('taken') : t('markAsTaken')}
                </button>
              ) : (
                <div 
                  className={`w-full font-bold py-2.5 rounded-xl transition-all text-sm shadow-sm border text-center ${
                    medTaken 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-[#f4f7fa] text-gray-500 border-transparent'
                  }`}
                >
                  {medTaken ? t('takenByPatient') : t('pendingPatientAction')}
                </div>
              )
            ) : (
              <span className="inline-block bg-gray-50 text-gray-400 px-2 py-0.5 rounded text-[11px] font-bold">
                Nothing due
              </span>
            )}
          </div>
        </div>

        {/* Sleep Pattern */}
        <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between h-56">
          <div className="flex justify-between items-center">
             <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
             </div>
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('sleepPattern')}</span>
          </div>
          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-gray-900 tracking-tight">{sleepString || "--"}</span>
              {sleepString && <span className="text-sm font-bold text-purple-500">Recorded</span>}
            </div>
            {sleepString ? (
              <>
                <p className="text-[10px] text-gray-400 mb-2">Estimated from your logs — verify with your care team</p>
                <span className="inline-block bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[11px] font-bold">{t('loggedToday')}</span>
              </>
            ) : (
              <span className="inline-block bg-gray-50 text-gray-400 px-2 py-0.5 rounded text-[11px] font-bold">{t('noRecentLogs')}</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Weather Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
        className="mb-8"
        data-testid="weather-widget"
      >
        <div className="glass-card rounded-[2rem] p-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Weather</span>
              {hydrationTemperature !== null && (
                <span className="bg-sky-50 text-sky-600 px-2 py-0.5 rounded-md text-[10px] font-bold">{hydrationTemperature}°C</span>
              )}
            </div>
            {hydrationTemperature !== null ? (
              <p className="text-sm font-semibold text-gray-700">
                Current temperature: {hydrationTemperature}°C · Hydration goal: {hydrationGoal} mL
              </p>
            ) : locationError ? (
              <p className="text-sm font-medium text-gray-500">
                Weather unavailable — using default hydration goal ({hydrationGoal} mL)
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-400 animate-pulse">Loading weather data...</p>
            )}

            {/* City Preset Selection (Allows manual location override/fallback) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Location:</span>
              <button
                onClick={handleAutoDetectLocation}
                disabled={detectingLocation}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100/60 hover:border-blue-200 transition-all shadow-sm flex items-center gap-1 disabled:opacity-50"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {detectingLocation ? 'Detecting...' : 'Auto-Detect'}
              </button>
              {cityPresets && cityPresets.length > 0 && cityPresets.map((city) => (
                <button
                  key={city.name}
                  onClick={() => fetchWeatherByLocation(city.lat, city.lon)}
                  className="bg-gray-50 hover:bg-sky-50 hover:text-sky-600 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200/60 hover:border-sky-100 transition-all shadow-sm"
                >
                  {city.name}
                </button>
              ))}
            </div>
            {geoError && (
              <p className="text-red-500 text-[9px] font-bold mt-2 bg-red-50 border border-red-100 rounded-lg px-2 py-1 max-w-max">
                ⚠️ {geoError}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Row */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Link href="/dashboard/visit-prep" className="glass-card p-6 rounded-[2rem] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all group block">
          <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mb-6 shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </div>
          <h4 className="font-bold text-gray-900 text-[15px] mb-1">{t('visitPrep')}</h4>
          <p className="text-[11px] font-medium text-gray-500">{t('prepareForDoctor')}</p>
        </Link>
        <Link href="/dashboard/documents" className="glass-card p-6 rounded-[2rem] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all group block">
          <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </div>
          <h4 className="font-bold text-gray-900 text-[15px] mb-1">{t('documentVault')}</h4>
          <p className="text-[11px] font-medium text-gray-500">{t('viewPastLabs')}</p>
        </Link>
        <Link href="/dashboard/health-trends" className="glass-card p-6 rounded-[2rem] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-100 transition-all group block">
          <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </div>
          <h4 className="font-bold text-gray-900 text-[15px] mb-1">{t('healthTrends')}</h4>
          <p className="text-[11px] font-medium text-gray-500">{t('thirtyDayAnalysis')}</p>
        </Link>
        <HydrationCard />
      </motion.div>

    </div>
  );
}
