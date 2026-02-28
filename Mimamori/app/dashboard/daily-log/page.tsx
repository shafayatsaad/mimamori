'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getEntityLabel } from '@/lib/ner-entity-labels';

export default function DailyLogPage() {
  const { logs, addLog, updateLog, removeLog, documents, syncFailed } = useAppContext();
  const [dynamicProbes, setDynamicProbes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [logText, setLogText] = useState('');
  const [selectedProbes, setSelectedProbes] = useState<string[]>([]);
  const [isRefreshingProbes, setIsRefreshingProbes] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const probeScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [recommendation, setRecommendation] = useState<{ recommendation: string; severity: 'good' | 'info' | 'warning' } | null>(null);
  const [isGeneratingRec, setIsGeneratingRec] = useState(false);
  const [showProbeModal, setShowProbeModal] = useState(false);

  // Conversation session: accumulates all answers across probe rounds so follow-ups have full context
  const [conversationAnswers, setConversationAnswers] = useState<string[]>([]);
  // Tracks which probe round we're on (0 = initial, 1+ = follow-up rounds)
  const [probeRound, setProbeRound] = useState(0);
  // History stack for back navigation — each entry is a snapshot before advancing
  const [probeHistory, setProbeHistory] = useState<{ probes: any[]; answers: string[]; selected: string[]; round: number }[]>([]);
  // Original log text that triggered the probe session — included in follow-up context
  const [probeSessionLogText, setProbeSessionLogText] = useState('');
  // ID of the log entry being enriched with probe answers + recommendation
  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const MAX_PROBE_ROUNDS = 3;

  const updateScrollArrows = useCallback(() => {
    const el = probeScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollProbes = (dir: 'left' | 'right') => {
    const el = probeScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  // Update arrow visibility when probes change
  useEffect(() => {
    updateScrollArrows();
  }, [dynamicProbes.length, updateScrollArrows]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  // Auto-resize textarea whenever logText changes (covers programmatic updates like refine, speech, clear)
  useEffect(() => {
    autoResizeTextarea();
  }, [logText]);

  // Track shown probe question titles per calendar day for deduplication (Bug 1.16)
  const [shownProbeTitlesForToday, setShownProbeTitlesForToday] = useState<Set<string>>(new Set());

  const getTodayDateKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const isLogFromToday = (logDate: string): boolean => {
    const todayKey = getTodayDateKey();
    // Try YYYY-MM-DD prefix match first
    if (logDate.startsWith(todayKey)) return true;
    // Parse the localized date string (e.g. "Jan 15, 2025, 10:30 AM")
    const parsed = new Date(logDate);
    if (!isNaN(parsed.getTime())) {
      const parsedKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      return parsedKey === todayKey;
    }
    return false;
  };

  // On mount and when logs change, collect probe titles already answered today
  useEffect(() => {
    const todayShownTitles = new Set<string>();

    for (const log of logs) {
      if (log.date && isLogFromToday(log.date)) {
        if (log.probeAnswers) {
          for (const pa of log.probeAnswers) {
            if (pa.title) todayShownTitles.add(pa.title);
          }
        }
        // Also extract titles from the probes string array (format: "Title: Answer")
        if (log.probes) {
          for (const probe of log.probes) {
            const title = probe.split(': ')[0];
            if (title) todayShownTitles.add(title);
          }
        }
      }
    }

    setShownProbeTitlesForToday(todayShownTitles);
  }, [logs]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            setLogText(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
          setInterimText(currentInterim);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsRecording(false);
          setInterimText('');
        };

        recognition.onend = () => {
          setIsRecording(false);
          setInterimText('');
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimText('');
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('Speech recognition is not supported in this browser. Please try Chrome or Safari.');
      }
    }
  };

  // After saving a log, generate reactive probes based on the log content
  const fetchReactiveProbes = async (logContent: string, logEntities: any[]) => {
    setIsRefreshingProbes(true);
    setShowProbeModal(true);
    try {
      const extraContext = `The patient just logged: "${logContent}"\n` +
        (logEntities.length > 0 ? `Detected entities: ${logEntities.map((e: any) => e.Text).join(', ')}` : '');
      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(0, 5),
          documents: documents.slice(0, 5),
          promptType: 'generate-followup-probes',
          extraContext
        })
      });
      if (res.ok) {
        const data = await res.json();
        let parsed: any[] = [];
        try { parsed = JSON.parse(data.insight); } catch (_e) { /* empty */ }
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDynamicProbes(parsed);
          setProbeRound(1);
        } else {
          setShowProbeModal(false);
        }
        // If empty array, no probes needed — that's fine
      } else {
        setShowProbeModal(false);
      }
    } catch (err) {
      console.error('Reactive probe generation failed:', err);
      setShowProbeModal(false);
    } finally {
      setIsRefreshingProbes(false);
    }
  };


  const handleSaveLog = async () => {
    if (!logText.trim()) return alert('Please enter a log.');

    let entities: any[] = [];
    try {
      const res = await fetch('/api/analyze-medical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: logText })
      });
      if (res.ok) {
        const data = await res.json();
        entities = data.entities || [];
      }
    } catch (err) {
      console.error('Failed to extract entities:', err);
    }

    const logId = addLog(logText, [], entities);
    const savedText = logText;
    const savedEntities = entities;
    setLogText('');
    setProbeSessionLogText(savedText);
    setActiveLogId(logId);
    showToast('Log saved. Checking if any follow-up questions are needed...');

    // Generate reactive probes based on what the patient just logged
    fetchReactiveProbes(savedText, savedEntities);
  };

  const fetchFollowUpProbes = async (allSessionAnswers: string[]) => {
    setIsRefreshingProbes(true);
    try {
      // Include original log text + full conversation history for context
      const answersContext = `The patient originally logged: "${probeSessionLogText}"\n\nPrevious answers:\n` +
        allSessionAnswers.map(p => `- ${p}`).join('\n');
      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(0, 5),
          documents: documents.slice(0, 5),
          promptType: 'generate-followup-probes',
          extraContext: answersContext
        })
      });
      if (res.ok) {
        const data = await res.json();
        let parsed = [];
        try {
          parsed = JSON.parse(data.insight);
        } catch (_e) { /* empty */ }
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Append follow-up probes — then check if any survive deduplication
          const allProbes = [...dynamicProbes, ...parsed];
          const answeredTitles = new Set(allSessionAnswers.map(a => a.split(': ')[0]));
          const newVisible = parsed.filter(
            (p: any) => !answeredTitles.has(p.title) && !shownProbeTitlesForToday.has(p.title)
          );
          if (newVisible.length > 0) {
            setDynamicProbes(allProbes);
            setProbeRound(r => r + 1);
          } else {
            // All new probes were duplicates — finish the conversation
            handleFinishProbes(allSessionAnswers);
          }
        } else {
          // No follow-ups needed — finish the conversation
          handleFinishProbes(allSessionAnswers);
        }
      } else {
        handleFinishProbes(allSessionAnswers);
      }
    } catch (err) {
      console.error('Follow-up probe generation failed:', err);
      handleFinishProbes(allSessionAnswers);
    } finally {
      setIsRefreshingProbes(false);
    }
  };

  // "Next" button handler for probe conversation flow
  const handleProbeNext = async () => {
    if (selectedProbes.length === 0) return;

    // Save snapshot for back navigation before advancing
    setProbeHistory(prev => [...prev, {
      probes: [...dynamicProbes],
      answers: [...conversationAnswers],
      selected: [...selectedProbes],
      round: probeRound
    }]);

    // Accumulate into conversation session (don't save yet — save once at the end)
    const allAnswers = [...conversationAnswers, ...selectedProbes];
    setConversationAnswers(allAnswers);

    // Clear selections for next round
    setSelectedProbes([]);

    // Cap at MAX_PROBE_ROUNDS to prevent endless loops
    if (probeRound >= MAX_PROBE_ROUNDS) {
      handleFinishProbes(allAnswers);
      return;
    }

    // Try to generate follow-up probes with full conversation context
    await fetchFollowUpProbes(allAnswers);
  };

  // "Back" button handler — restore previous round's state
  const handleProbeBack = () => {
    if (probeHistory.length === 0) return;
    const prev = probeHistory[probeHistory.length - 1];
    setDynamicProbes(prev.probes);
    setConversationAnswers(prev.answers);
    setSelectedProbes(prev.selected);
    setProbeRound(prev.round);
    setProbeHistory(h => h.slice(0, -1));
  };

  // Finalize the conversation — merge answers into the original log entry, then generate recommendation
  const handleFinishProbes = (allAnswers: string[]) => {
    // Build structured probe answers from the full conversation
    const probeAnswers = allAnswers.map(probe => {
      const [title, answer] = probe.split(': ');
      const matchedProbe = dynamicProbes.find((p: any) => p.title === title);
      return {
        title: title || 'General',
        question: matchedProbe?.question || title,
        answer: answer || probe
      };
    });

    // Merge probe answers into the original log entry
    if (activeLogId) {
      updateLog(activeLogId, { probes: allAnswers, probeAnswers });
    }

    // Reset conversation state
    setConversationAnswers([]);
    setProbeRound(0);
    setProbeHistory([]);
    setProbeSessionLogText('');
    setShowProbeModal(false);
    showToast('All probes completed. Generating your recommendation...');

    // Generate recommendation and store it on the log entry
    const logIdForRec = activeLogId;
    fetchRecommendation(allAnswers, logIdForRec);
  };

  const fetchRecommendation = async (allSessionAnswers: string[], logId: string | null) => {
    setIsGeneratingRec(true);
    try {
      // Use the passed allSessionAnswers directly — logs state may be stale
      const answersContext = [...new Set(allSessionAnswers)].map(p => `- ${p}`).join('\n');
      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(0, 5),
          documents: documents.slice(0, 5),
          promptType: 'generate-recommendation',
          extraContext: answersContext
        })
      });
      if (res.ok) {
        const data = await res.json();
        let rec: { recommendation: string; severity: 'good' | 'info' | 'warning' } | null = null;
        try {
          const parsed = JSON.parse(data.insight);
          if (parsed && parsed.recommendation) {
            rec = parsed;
          }
        } catch (_e) {
          // If not valid JSON, use the raw text as an info recommendation
          if (data.insight && data.insight.trim()) {
            rec = { recommendation: data.insight, severity: 'info' };
          }
        }
        if (rec) {
          // Store recommendation inline on the log entry
          if (logId) {
            updateLog(logId, { recommendation: rec });
          }
          setRecommendation(rec);
        }
      }
    } catch (err) {
      console.error('Recommendation generation failed:', err);
    } finally {
      setIsGeneratingRec(false);
      setActiveLogId(null);
    }
  };

  const handleRefineAI = async () => {
    if (!logText.trim()) return showToast('Please enter text to refine.');
    setIsRefining(true);
    try {
      const res = await fetch('/api/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: logText })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.refinedText) {
          setLogText(data.refinedText);
          showToast('Text refined successfully.');
        }
      } else {
        showToast('Failed to refine text.');
      }
    } catch (err) {
      console.error('Refine error:', err);
      showToast('An error occurred while refining.');
    } finally {
      setIsRefining(false);
    }
  };

  const toggleProbe = (probe: string) => {
    setSelectedProbes(prev => {
      if (prev.includes(probe)) {
        return prev.filter(p => p !== probe);
      }
      const prefix = probe.split(": ")[0] + ": ";
      return [...prev.filter(p => !p.startsWith(prefix)), probe];
    });
  };

  // Filter out probes already answered in the current conversation session
  const answeredTitlesInSession = new Set(conversationAnswers.map(a => a.split(': ')[0]));
  const filteredProbes = dynamicProbes.filter(
    (probe: any) =>
      !shownProbeTitlesForToday.has(probe.title) &&
      !answeredTitlesInSession.has(probe.title)
  );

  // Whether all currently visible probes have been answered
  const allCurrentProbesAnswered = filteredProbes.length > 0 && filteredProbes.every(
    (p: any) => selectedProbes.some(s => s.startsWith(p.title + ': '))
  );

  // Sorting & filtering for log history
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logSortOrder, setLogSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredLogs = logs.filter(log => {
    if (!logSearchTerm.trim()) return true;
    const term = logSearchTerm.toLowerCase();
    const textMatch = log.text.toLowerCase().includes(term);
    const probeMatch = log.probes.some(p => p.toLowerCase().includes(term));
    const entityMatch = log.entities?.some((e: any) => e.Text?.toLowerCase().includes(term)) ?? false;
    return textMatch || probeMatch || entityMatch;
  }).sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    const safeA = Number.isNaN(timeA) ? 0 : timeA;
    const safeB = Number.isNaN(timeB) ? 0 : timeB;
    return logSortOrder === 'newest' ? safeB - safeA : safeA - safeB;
  });

  // Pagination for log history (Bug 1.17)
  const LOG_PAGE_SIZE = 10;
  const [logPage, setLogPage] = useState(1);
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  // Reset to page 1 if logs/filters change and current page is out of range
  useEffect(() => {
    if (logPage > totalLogPages) setLogPage(1);
  }, [filteredLogs.length, totalLogPages]);
  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setLogPage(1);
  }, [logSearchTerm, logSortOrder]);
  const paginatedLogs = filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-4xl mx-auto min-w-0">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start mb-8 gap-3">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            Today's Health Log
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-400 font-bold mt-1 text-sm tracking-wide"
          >
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </motion.p>
        </div>
      </div>

      {/* Main Input Area */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-[#f8f9fc] rounded-[2.5rem] p-10 md:p-14 border border-gray-100 shadow-inner mb-12 flex flex-col items-center justify-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/30 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col items-center">
          <button 
            onClick={toggleRecording}
            className={`group relative w-28 h-28 mb-10 flex items-center justify-center transition-all ${isRecording ? 'scale-110' : ''}`}
          >
            <div className={`absolute inset-0 rounded-full opacity-20 group-hover:scale-125 transition-transform duration-700 ease-out ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
            <div className={`absolute inset-2 rounded-full opacity-40 group-hover:scale-110 transition-transform duration-500 ease-out ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`} />
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}>
               {isRecording ? (
                 <div className="w-8 h-8 bg-white rounded-sm"></div>
               ) : (
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
               )}
            </div>
          </button>

          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-8">
            Speak naturally. Mimamori will organize the rest.
          </h2>

          <AnimatePresence>
            {isRecording && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-4 bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-blue-100 flex flex-col items-center pointer-events-none z-50 w-80"
              >
                <div className="flex items-center gap-2 text-blue-500 font-bold mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  Listening...
                </div>
                <p className="text-gray-600 text-sm font-medium italic text-center w-full break-words">
                  {interimText || "Speak now..."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 w-full max-w-sm mb-8">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <div className="w-full rounded-3xl bg-white border border-gray-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <textarea 
              ref={textareaRef}
              value={logText}
              onChange={e => setLogText(e.target.value)}
              placeholder="Type how you are feeling..." 
              rows={3}
              className="w-full bg-transparent p-5 sm:p-6 border-none focus:outline-none font-medium text-gray-800 placeholder:text-gray-300 resize-none text-base sm:text-lg overflow-hidden"
              style={{ minHeight: '5rem' }}
            />
            <div className="px-4 pb-4 sm:px-6 sm:pb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
              <button 
                onClick={handleRefineAI} 
                disabled={isRefining || !logText.trim()}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-full font-bold text-sm transition-colors ${!logText.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                {isRefining ? (
                  <div className="w-5 h-5 sm:w-4 sm:h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 sm:w-[14px] sm:h-[14px]"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                )}
                {isRefining ? 'Refining...' : 'Refine with AI'}
              </button>
              <button onClick={handleSaveLog} className="bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all active:scale-95 text-sm">
                Save Log
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Log History */}
      {logs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              History <span className="w-2.5 h-2.5 bg-[#3ba53b] rounded-full inline-block ml-1"></span>
              <span className="text-sm font-medium text-gray-400 ml-2">({filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'})</span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  type="text"
                  value={logSearchTerm}
                  onChange={e => setLogSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-9 pr-3 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48 transition-all"
                  aria-label="Search log history"
                />
              </div>
              <button
                onClick={() => setLogSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={`Sort by ${logSortOrder === 'newest' ? 'oldest first' : 'newest first'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"></path><path d="M11 9h7"></path><path d="M11 13h4"></path><path d="M3 17l3 3 3-3"></path><path d="M6 18V4"></path></svg>
                {logSortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          </div>
          {filteredLogs.length === 0 && logSearchTerm.trim() && (
            <div className="text-center py-8 text-gray-400 font-medium text-sm">
              No logs matching "{logSearchTerm}"
            </div>
          )}
          <div className="space-y-4">
            <AnimatePresence>
              {paginatedLogs.map((log) => (
                <motion.div 
                  key={log.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-gray-100 p-6 rounded-[1.5rem] shadow-sm flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-gray-800 font-medium text-[15px] max-w-2xl">{log.text}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">{log.date}</span>
                      <button
                        onClick={() => removeLog(log.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Delete log"
                        title="Delete log"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  {log.probes.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {log.probes.map((probe, i) => (
                        <span key={`probe-${i}`} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">
                          {probe}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.probeAnswers && log.probeAnswers.length > 0 && (
                    <div className="mt-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-blue-100/50 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Answered Health Probes</span>
                      {log.probeAnswers.map((pa, i) => (
                        <div key={`pa-${i}`} className="flex items-start gap-2">
                          <span className="text-blue-400 text-xs mt-0.5">Q:</span>
                          <div>
                            <p className="text-xs text-gray-600 font-medium">{pa.question}</p>
                            <p className="text-xs text-gray-900 font-bold">→ {pa.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {log.entities && log.entities.length > 0 && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {log.entities.map((entity, i) => (
                        <span key={`entity-${i}`} className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-[10px] font-bold border border-purple-100 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                          {entity.Text}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Inline Recommendation */}
                  {log.recommendation && (
                    <div className={`mt-3 rounded-2xl p-4 flex gap-3 items-start border ${
                      log.recommendation.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : log.recommendation.severity === 'good'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-blue-50 border-blue-100'
                    }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        log.recommendation.severity === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : log.recommendation.severity === 'good'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-blue-100 text-blue-600'
                      }`}>
                        {log.recommendation.severity === 'warning' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        ) : log.recommendation.severity === 'good' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                          log.recommendation.severity === 'warning' ? 'text-amber-500' : log.recommendation.severity === 'good' ? 'text-emerald-500' : 'text-blue-500'
                        }`}>AI Recommendation</p>
                        <p className="text-[13px] font-medium text-gray-800 leading-relaxed">{log.recommendation.recommendation}</p>
                      </div>
                    </div>
                  )}
                  {/* Loading state for recommendation generation on active log */}
                  {isGeneratingRec && activeLogId === log.id && !log.recommendation && (
                    <div className="mt-3 bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span className="text-xs font-medium text-blue-500">Generating recommendation...</span>
                    </div>
                  )}
                  {syncFailed ? (
                    <div className="flex items-center gap-1.5 mt-2 bg-amber-50 w-max px-2.5 py-1 rounded border border-amber-200 text-[10px] font-bold text-amber-700">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path></svg>
                      Saved locally — sync pending
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2 bg-emerald-50 w-max px-2.5 py-1 rounded border border-emerald-100 text-[10px] font-bold text-emerald-600">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Synced to Care Team
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {/* Pagination Controls */}
          {totalLogPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setLogPage(p => Math.max(1, p - 1))}
                disabled={logPage === 1}
                className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                aria-label="Previous page"
              >
                ← Prev
              </button>
              {Array.from({ length: totalLogPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setLogPage(page)}
                  className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                    page === logPage
                      ? 'bg-[var(--color-brand-dark)] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label={`Page ${page}`}
                  aria-current={page === logPage ? 'page' : undefined}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                disabled={logPage === totalLogPages}
                className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Follow-up Questions Modal */}
      <AnimatePresence>
        {showProbeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                if (!isRefreshingProbes) {
                  setShowProbeModal(false);
                  setDynamicProbes([]);
                  setSelectedProbes([]);
                  setConversationAnswers([]);
                  setProbeRound(0);
                  setProbeHistory([]);
                  setProbeSessionLogText('');
                  setActiveLogId(null);
                }
              }}
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Follow-up Questions
                    {probeRound > 1 && <span className="text-sm text-indigo-500 font-bold">Round {probeRound}</span>}
                  </h3>
                  {probeSessionLogText && (
                    <p className="text-sm text-gray-400 font-medium mt-1 truncate max-w-md">
                      Re: &ldquo;{probeSessionLogText}&rdquo;
                    </p>
                  )}
                  {isRefreshingProbes && (
                    <p className="text-sm text-gray-400 font-medium mt-1 animate-pulse">Analyzing your log...</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!isRefreshingProbes) {
                      setShowProbeModal(false);
                      setDynamicProbes([]);
                      setSelectedProbes([]);
                      setConversationAnswers([]);
                      setProbeRound(0);
                      setProbeHistory([]);
                      setProbeSessionLogText('');
                      setActiveLogId(null);
                    }
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {/* Previous answers summary for follow-up rounds */}
                {probeRound > 0 && conversationAnswers.length > 0 && (
                  <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Your answers so far</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {conversationAnswers.map((a, i) => (
                        <span key={i} className="bg-white text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-bold border border-indigo-100">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Probe Cards */}
                {isRefreshingProbes && filteredProbes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-gray-400">Generating follow-up questions...</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Left arrow */}
                    {filteredProbes.length >= 3 && canScrollLeft && (
                      <button
                        onClick={() => scrollProbes('left')}
                        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all active:scale-90"
                        aria-label="Scroll probes left"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}

                    <motion.div
                      ref={probeScrollRef}
                      onScroll={updateScrollArrows}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                      className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar scroll-smooth"
                    >
                      {filteredProbes.map((probe: any, idx: number) => {
                        const colors = [
                          { bg: 'bg-red-50', text: 'text-red-500' },
                          { bg: 'bg-indigo-50', text: 'text-indigo-500' },
                          { bg: 'bg-amber-50', text: 'text-amber-500' },
                          { bg: 'bg-purple-50', text: 'text-purple-500' },
                          { bg: 'bg-emerald-50', text: 'text-emerald-500' }
                        ];
                        const color = colors[idx % colors.length];

                        return (
                          <div key={`probe-${idx}`} className="flex-shrink-0 w-72 bg-white border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[2rem] p-7 snap-start flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <div className={`w-6 h-6 ${color.bg} ${color.text} flex items-center justify-center rounded-full`}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                                </div>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{probe.title}</span>
                              </div>
                              <p className="text-[var(--color-brand-dark)] font-bold text-lg leading-snug tracking-tight mb-8">{probe.question}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-auto">
                              {probe.options && probe.options.map((val: string) => {
                                const isSelected = selectedProbes.includes(`${probe.title}: ${val}`);
                                return (
                                  <button
                                    key={val}
                                    onClick={() => toggleProbe(`${probe.title}: ${val}`)}
                                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${isSelected ? `${color.bg} ${color.text} shadow-sm ring-1 ring-current/20` : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>

                    {/* Right arrow */}
                    {filteredProbes.length >= 3 && canScrollRight && (
                      <button
                        onClick={() => scrollProbes('right')}
                        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all active:scale-90"
                        aria-label="Scroll probes right"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}

                    {/* Mobile scroll indicator */}
                    {filteredProbes.length > 1 && (
                      <div className="flex items-center justify-center gap-1.5 mt-2 md:hidden">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Swipe for more</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {(selectedProbes.length > 0 || probeHistory.length > 0) && (
                <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    {probeHistory.length > 0 && (
                      <button
                        onClick={handleProbeBack}
                        disabled={isRefreshingProbes}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold transition-all border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 active:scale-95 disabled:opacity-50"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Back
                      </button>
                    )}
                    <span className="text-sm text-gray-500 font-medium">
                      {selectedProbes.length} of {filteredProbes.length} answered
                    </span>
                  </div>
                  {selectedProbes.length > 0 && (
                    <button
                      onClick={handleProbeNext}
                      disabled={isRefreshingProbes}
                      className="flex items-center gap-2 bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isRefreshingProbes ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Analyzing...
                        </>
                      ) : allCurrentProbesAnswered ? (
                        <>
                          Submit
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Next ({selectedProbes.length}/{filteredProbes.length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
