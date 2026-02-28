'use client';
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { computeWellnessScore } from '@/lib/wellness-score';

export default function HealthTrendsPage() {
  const { logs, documents, patientProfile } = useAppContext();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedScoreDay, setExpandedScoreDay] = useState<number | null>(null);

  useEffect(() => {
    async function fetchInsight() {
      if (logs.length === 0) return;
      setIsGenerating(true);
      try {
        const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));
        const res = await fetch('/api/medical-reasoning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: logs.slice(0, 10), documents: analyzedDocs }) 
        });
        const data = await res.json();
        if (data.insight) setAiInsight(data.insight);
      } catch (err) {
        console.error('Failed to parse AI medical reasoning', err);
      } finally {
        setIsGenerating(false);
      }
    }
    fetchInsight();
  }, [logs, documents]);

  // Group logs by day
  const dayGroups = useMemo(() => {
    const groups: { [key: string]: typeof logs } = {};
    
    // Create a normalized bucket key. If a log date is "10:30 AM", treat it as today's date.
    const todayKey = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    logs.forEach(log => {
      // Check if it's a full date string or just a time string. Time strings don't have commas or full years.
      let dayKey = todayKey;
      if (log.date && log.date.includes(new Date().getFullYear().toString())) {
         dayKey = log.date.split(',')[0].trim(); // e.g., "Oct 25" from "Oct 25, 2024, 10:30 AM"
      } else if (log.date && log.date.length > 10) {
         // Fallback if there's a date-like string
         dayKey = log.date.substring(0, 10);
      }
      
      // Group all logs into date-friendly buckets
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(log);
    });
    
    return Object.entries(groups).map(([date, dayLogs], idx) => {
      // Calculate a wellness score for this day using the documented weighted formula
      const answers = dayLogs.flatMap(l => l.probeAnswers || []);
      const { score, breakdown } = computeWellnessScore(answers);
      
      return {
        label: `Day ${idx + 1}`,
        date,
        logs: dayLogs,
        logCount: dayLogs.length,
        probeCount: dayLogs.reduce((sum, l) => sum + (l.probeAnswers?.length || 0), 0),
        entityCount: dayLogs.reduce((sum, l) => sum + (l.entities?.length || 0), 0),
        wellnessScore: score,
        wellnessBreakdown: breakdown,
      };
    });
  }, [logs]);

  // Extract metrics from probe answers — use the most recent answers so new log entries are reflected
  const metrics = useMemo(() => {
    // Reverse so the newest log entries come first, ensuring .find() picks the latest answer
    const allProbeAnswers = [...logs].reverse().flatMap(l => l.probeAnswers || []);
    const bp = allProbeAnswers.find(p => p.title === 'Blood Pressure');
    const sleep = allProbeAnswers.find(p => p.title === 'Sleep Quality');
    const med = allProbeAnswers.find(p => p.title === 'Medication');
    const energy = allProbeAnswers.find(p => p.title === 'Energy Level');
    const pain = allProbeAnswers.find(p => p.title === 'Pain Level');

    // Also extract from text regex as fallback — prioritize most recent logs
    const unitedLogs = [...logs].reverse().map(l => (l.text + ' ' + (l.transcript || ''))).join(' ');
    const bpMatch = unitedLogs.match(/(\d{2,3})\/(\d{2,3})/);
    const sleepMatch = unitedLogs.match(/(\d+)\s*(?:hours|hr|hrs|h)/i);

    return {
      bp: bp?.answer || (bpMatch ? `${bpMatch[1]}/${bpMatch[2]}` : null),
      sleep: sleep?.answer || (sleepMatch ? `${sleepMatch[1]}h` : null),
      medication: med?.answer || null,
      energy: energy?.answer || null,
      pain: pain?.answer || null,
    };
  }, [logs]);

  const primaryCondition = patientProfile?.conditions?.[0] || 'General Wellness';
  const totalDays = dayGroups.length;

  const getMetricColor = (value: string | null) => {
    if (!value) return 'text-gray-400';
    const v = value.toLowerCase();
    if (v.includes('normal') || v.includes('good') || v.includes('restful') || v.includes('all') || v.includes('none') || v.includes('7-9')) return 'text-emerald-600';
    if (v.includes('elevated') || v.includes('moderate') || v.includes('5-6') || v.includes('missed one') || v.includes('mild')) return 'text-amber-600';
    return 'text-red-500';
  };

  const getMetricBgColor = (value: string | null) => {
    if (!value) return 'bg-gray-50';
    const v = value.toLowerCase();
    if (v.includes('normal') || v.includes('good') || v.includes('restful') || v.includes('all') || v.includes('none') || v.includes('7-9')) return 'bg-emerald-50';
    if (v.includes('elevated') || v.includes('moderate') || v.includes('5-6') || v.includes('missed one') || v.includes('mild')) return 'bg-amber-50';
    return 'bg-red-50';
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-6xl mx-auto relative pb-6 min-w-0">
      
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-3">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            Health Trends
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="text-gray-400 font-medium mt-1 text-sm"
          >
            {totalDays === 0 ? 'Start logging to see your health journey' : `Tracking ${totalDays} day${totalDays > 1 ? 's' : ''} of health data`}
          </motion.p>
        </div>
      </div>

      {logs.length > 0 ? (
        <>
          {/* AI Insight Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-gradient-to-r from-[var(--color-brand-dark)] to-[#1C2951] rounded-2xl p-6 mb-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="flex items-start gap-3 relative z-10">
              <span className="text-xl mt-0.5">✨</span>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-2">AI Health Correlation</p>
                <div className="text-white/90 font-medium text-[15px] leading-relaxed">
                  {isGenerating ? (
                    <p className="animate-pulse text-white/50">Mimamori is analyzing your health data...</p>
                  ) : aiInsight ? (
                    <div>
                      {aiInsight.split(/\n\n|\n/).filter(p => p.trim()).map((paragraph, i) => (
                        <p key={i} className="mb-2">{paragraph.trim()}</p>
                      ))}
                    </div>
                  ) : (
                    <p>Record more daily logs to unlock AI-driven health correlations and predictive insights.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Health Metrics Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"
          >
            {[
              { label: 'Blood Pressure', value: metrics.bp, icon: '❤️', fallback: 'Log your BP' },
              { label: 'Sleep', value: metrics.sleep, icon: '🌙', fallback: 'Track sleep' },
              { label: 'Medication', value: metrics.medication, icon: '💊', fallback: 'Log meds' },
              { label: 'Energy', value: metrics.energy, icon: '⚡', fallback: 'Rate energy' },
              { label: 'Pain', value: metrics.pain, icon: '🩹', fallback: 'Log pain' },
            ].map((m, i) => (
              <motion.div 
                key={m.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
                className={`${getMetricBgColor(m.value)} border border-gray-100/80 rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:shadow-md`}
              >
                <span className="text-xl mb-2">{m.icon}</span>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{m.label}</p>
                <p className={`text-sm font-black ${getMetricColor(m.value)} leading-tight`}>
                  {m.value || m.fallback}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Day Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-xl font-black text-gray-900 tracking-tight mb-4 flex items-center gap-2">
              Daily Health Journal
              <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{totalDays} Day{totalDays > 1 ? 's' : ''}</span>
            </h2>

            {totalDays <= 1 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md">1</div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Day 1 — {dayGroups[0]?.date || 'Today'}</h3>
                    <p className="text-gray-400 text-xs font-medium">{dayGroups[0]?.logCount || 0} log entries • {dayGroups[0]?.probeCount || 0} health probe answers • {dayGroups[0]?.entityCount || 0} medical entities</p>
                  </div>
                </div>

                {/* Bar chart for Day 1 */}
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {['BP', 'Sleep', 'Meds', 'Energy', 'Pain'].map((label, idx) => {
                    const vals = [metrics.bp, metrics.sleep, metrics.medication, metrics.energy, metrics.pain];
                    const val = vals[idx];
                    const height = val ? (val.toLowerCase().includes('normal') || val.toLowerCase().includes('good') || val.toLowerCase().includes('all') || val.toLowerCase().includes('none') || val.toLowerCase().includes('7-9') ? '80%' : val.toLowerCase().includes('elevated') || val.toLowerCase().includes('moderate') || val.toLowerCase().includes('5-6') || val.toLowerCase().includes('missed one') || val.toLowerCase().includes('mild') ? '50%' : '25%') : '10%';
                    const barColor = val ? getMetricColor(val).replace('text-', 'bg-') : 'bg-gray-200';
                    return (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <div className="w-full h-24 bg-gray-50 rounded-lg relative overflow-hidden flex items-end">
                          <motion.div 
                            initial={{ height: 0 }} animate={{ height }} transition={{ delay: 0.5 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                            className={`w-full ${barColor} rounded-lg`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Wellness Score for single day */}
                {dayGroups[0] && (
                  <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                      📈 Wellness Score
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Estimated from Logs</span>
                    </h3>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-sm ${
                        dayGroups[0].wellnessScore >= 75 ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' :
                        dayGroups[0].wellnessScore >= 50 ? 'bg-gradient-to-br from-amber-400 to-amber-500' :
                        'bg-gradient-to-br from-red-400 to-red-500'
                      }`}>
                        {dayGroups[0].wellnessScore}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Overall Score: {dayGroups[0].wellnessScore}/100</p>
                        <button
                          onClick={() => setExpandedScoreDay(expandedScoreDay === 0 ? null : 0)}
                          className="text-[11px] text-blue-600 font-medium hover:underline"
                        >
                          {expandedScoreDay === 0 ? 'Hide breakdown' : 'Show breakdown'}
                        </button>
                      </div>
                    </div>
                    {expandedScoreDay === 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                      >
                        <p className="text-xs font-bold text-gray-700 mb-3">Score Breakdown</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Sleep Quality', value: dayGroups[0].wellnessBreakdown.sleep, icon: '🌙', weight: '25%' },
                            { label: 'Pain Level', value: dayGroups[0].wellnessBreakdown.pain, icon: '🩹', weight: '25%' },
                            { label: 'Energy Level', value: dayGroups[0].wellnessBreakdown.energy, icon: '⚡', weight: '25%' },
                            { label: 'Medication', value: dayGroups[0].wellnessBreakdown.medication, icon: '💊', weight: '25%' },
                          ].map((factor) => (
                            <div key={factor.label} className="bg-white rounded-lg p-3 text-center border border-gray-100">
                              <span className="text-lg">{factor.icon}</span>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{factor.label}</p>
                              <p className="text-lg font-black text-gray-900">{factor.value}</p>
                              <p className="text-[9px] text-gray-400 font-medium">Weight: {factor.weight}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    <p className="mt-3 text-[10px] text-gray-400 font-medium leading-relaxed">
                      This score is an estimate based on your self-reported logs. It is not a clinical assessment. Verify with your care team.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-sm font-medium text-gray-600">
                    <span className="font-bold text-gray-900">Keep logging!</span> Add more days of data to unlock trend comparisons, graphs, and AI health predictions.
                  </p>
                </div>
              </div>
            ) : (
              /* Multi-day comparison view */
              <div className="space-y-4">
                {dayGroups.map((day, idx) => (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.1 }}
                    className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-10 h-10 ${idx === 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-200'} text-white rounded-xl flex items-center justify-center font-black text-sm shadow-sm`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{day.label} — {day.date}</h3>
                        <p className="text-gray-400 text-[11px] font-medium">{day.logCount} entries • {day.probeCount} probes • {day.entityCount} entities</p>
                      </div>
                      <div className="flex gap-1">
                        {day.logs.slice(0, 3).map((_, li) => (
                          <span key={li} className="w-2 h-2 rounded-full bg-blue-400"></span>
                        ))}
                      </div>
                    </div>

                    {/* Mini bar comparison */}
                    <div className="flex gap-2">
                      {day.logs.slice(0, 4).map((log, li) => (
                        <div key={li} className="flex-1 bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500 font-medium truncate">{log.text.slice(0, 40)}...</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                {/* Trend Graph - only show when multiple days exist */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                    📈 Wellness Score Trend
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Estimated from Logs</span>
                  </h3>
                  <div className="relative h-40 flex items-end gap-2 border-b border-gray-100 pb-2">
                    {dayGroups.map((day, idx) => {
                      const height = day.wellnessScore;
                      const isGood = height >= 75;
                      const isWarning = height < 75 && height >= 50;
                      const colorClass = isGood ? 'from-emerald-400 to-emerald-500' : isWarning ? 'from-amber-400 to-amber-500' : 'from-red-400 to-red-500';
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ height: 0 }} animate={{ height: `${height}%` }}
                          transition={{ delay: 0.6 + idx * 0.15, duration: 0.8, ease: "easeOut" }}
                          className={`flex-1 bg-gradient-to-t ${colorClass} rounded-t-xl relative group cursor-pointer shadow-sm`}
                          onClick={() => setExpandedScoreDay(expandedScoreDay === idx ? null : idx)}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-black text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-gray-100">{height}%</div>
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-400 whitespace-nowrap">{day.label}</div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-t-xl"></div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Breakdown expandable section */}
                  {expandedScoreDay !== null && dayGroups[expandedScoreDay] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="mt-8 bg-gray-50 rounded-xl p-4 border border-gray-100"
                    >
                      <p className="text-xs font-bold text-gray-700 mb-3">{dayGroups[expandedScoreDay].label} — Score Breakdown</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Sleep Quality', value: dayGroups[expandedScoreDay].wellnessBreakdown.sleep, icon: '🌙', weight: '25%' },
                          { label: 'Pain Level', value: dayGroups[expandedScoreDay].wellnessBreakdown.pain, icon: '🩹', weight: '25%' },
                          { label: 'Energy Level', value: dayGroups[expandedScoreDay].wellnessBreakdown.energy, icon: '⚡', weight: '25%' },
                          { label: 'Medication', value: dayGroups[expandedScoreDay].wellnessBreakdown.medication, icon: '💊', weight: '25%' },
                        ].map((factor) => (
                          <div key={factor.label} className="bg-white rounded-lg p-3 text-center border border-gray-100">
                            <span className="text-lg">{factor.icon}</span>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{factor.label}</p>
                            <p className="text-lg font-black text-gray-900">{factor.value}</p>
                            <p className="text-[9px] text-gray-400 font-medium">Weight: {factor.weight}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Wellness score disclaimer */}
                  <p className="mt-4 text-[10px] text-gray-400 font-medium leading-relaxed">
                    This score is an estimate based on your self-reported logs. It is not a clinical assessment. Verify with your care team.
                  </p>
                </motion.div>
              </div>
            )}
          </motion.div>

          {/* Documents Summary */}
          {documents.filter(d => d.analysis).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
                📋 Analyzed Documents
                <span className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{documents.filter(d => d.analysis).length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.filter(d => d.analysis).slice(0, 4).map((doc, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 text-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{doc.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center p-16 text-center bg-gradient-to-b from-white to-gray-50/50 border border-gray-100 rounded-3xl shadow-sm"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-lg">
            📊
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Start Your Health Journey</h2>
          <p className="text-gray-500 font-medium text-sm max-w-md leading-relaxed mb-6">
            Record daily health logs, answer AI probes, and upload medical documents to unlock personalized trends, predictive alerts, and AI health correlations.
          </p>
          <div className="flex gap-3">
            <a href="/dashboard/daily-log" className="bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all text-sm">Start Logging</a>
            <a href="/dashboard/documents" className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-full shadow-sm transition-all text-sm">Upload Documents</a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
