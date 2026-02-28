'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { isAppointmentPast } from '@/lib/appointment-utils';

export default function VisitPrepPage() {
  const { logs, documents, appointments, patientProfile, aiGenerations, setAIGeneration, getGenerationTriggerHash, customNotes, addCustomNote, removeCustomNote } = useAppContext();

  // Find the next upcoming appointment
  const nextAppointment = appointments
    .filter(appt => !isAppointmentPast(appt))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  const [newSymptom, setNewSymptom] = useState('');

  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  
  const [generatedPrep, setGeneratedPrep] = useState<{question: string, context: string} | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([]);

  // Export summary state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDraft, setExportDraft] = useState('');
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isRefiningExport, setIsRefiningExport] = useState(false);

  // Restore persisted visit-prep generation on mount
  useEffect(() => {
    const cached = aiGenerations['visit-prep'];
    if (cached && !generatedPrep) {
      try {
        const parsed = JSON.parse(cached.content);
        setGeneratedPrep(parsed);
        setExpandedQuestions([1]);
      } catch {
        setGeneratedPrep({ question: cached.content, context: 'Generated from your recent logs and documents.' });
        setExpandedQuestions([1]);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegenerate = async () => {
    if (logs.length === 0) {
      window.alert("Please add some 📋 logs to your dashboard first so I have data to analyze!");
      return;
    }
    setIsRegenerating(true);
    try {
      const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));

      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          logs: logs.slice(0, 10), 
          documents: analyzedDocs,
          promptType: 'visit-prep',
          customNotes: customNotes.map(n => n.text)
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        console.error('Medical reasoning API error:', errData);
        window.alert(errData.error || 'Failed to generate AI draft. Please try again.');
        return;
      }

      const data = await res.json();
      if (data.insight) {
        const currentHash = getGenerationTriggerHash();
        try {
          const parsed = JSON.parse(data.insight);
          setGeneratedPrep(parsed);
          setExpandedQuestions([1]); // auto expand
          setAIGeneration('visit-prep', data.insight, currentHash);
        } catch {
          // If the response isn't valid JSON, use it as plain text
          setGeneratedPrep({ question: data.insight, context: 'Generated from your recent logs and documents.' });
          setExpandedQuestions([1]);
          setAIGeneration('visit-prep', data.insight, currentHash);
        }
      } else {
        window.alert('No content was generated. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate visit prep:', err);
      window.alert('Unable to reach the AI service. Please check your connection and try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExport = async () => {
    if (logs.length === 0) {
      window.alert('Please add some logs first so the AI has data to summarize.');
      return;
    }
    setIsGeneratingExport(true);
    setShowExportModal(true);
    setExportDraft('');
    setEditPrompt('');
    try {
      const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));
      const apptContext = nextAppointment
        ? `Upcoming appointment: ${nextAppointment.type} with ${nextAppointment.doctor} (${nextAppointment.dept}) on ${nextAppointment.date}${nextAppointment.time ? ' at ' + nextAppointment.time : ''}.`
        : 'No specific upcoming appointment.';

      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(0, 15),
          documents: analyzedDocs,
          conditions: patientProfile.conditions,
          allergies: patientProfile.allergies,
          promptType: 'export-summary',
          extraContext: apptContext,
          customNotes: customNotes.map(n => n.text),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        setExportDraft(`⚠️ Failed to generate summary: ${errData.error || 'Unknown error'}. You can type your own summary below.`);
        return;
      }
      const data = await res.json();
      setExportDraft(data.insight || 'No summary generated. Please try again.');
    } catch {
      setExportDraft('⚠️ Unable to reach the AI service. You can type your own summary below.');
    } finally {
      setIsGeneratingExport(false);
    }
  };

  const handleRefineExport = async () => {
    if (!editPrompt.trim() || isRefiningExport) return;
    setIsRefiningExport(true);
    try {
      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: [{ text: `Current draft:\n${exportDraft}\n\nUser requested edits: ${editPrompt}` }],
          documents: [],
          conditions: patientProfile.conditions,
          allergies: patientProfile.allergies,
          promptType: 'export-summary',
          extraContext: 'The user wants to refine the existing visit summary draft. Apply the requested edits while keeping the medical summary structure intact.',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insight) setExportDraft(data.insight);
      }
    } catch {
      // keep current draft on error
    } finally {
      setIsRefiningExport(false);
      setEditPrompt('');
    }
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportDraft).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
  };

  const handlePrintExport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Visit Summary — Mimamori</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a1a1a;white-space:pre-wrap}h1{font-size:18px;margin-bottom:4px}p.sub{color:#888;font-size:13px;margin-top:0}</style></head><body><h1>Mimamori — Visit Preparation Summary</h1><p class="sub">${nextAppointment ? `${nextAppointment.type} with ${nextAppointment.doctor} — ${nextAppointment.date}` : 'General Summary'}</p><hr/>${exportDraft}</body></html>`);
    win.document.close();
    win.print();
  };

  const [copyToast, setCopyToast] = useState(false);

  const toggleQuestion = (idx: number) => {
    setExpandedQuestions(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const handleAddSymptom = () => {
    if (!newSymptom.trim()) return;
    addCustomNote(newSymptom.trim());
    setNewSymptom('');
  };

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    setCustomQuestions(prev => [newQuestion, ...prev]);
    setNewQuestion('');
  };
  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-5xl mx-auto min-w-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start mb-8 border-b border-gray-100 pb-6 gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3"
          >
            Visit Prep Draft
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 font-medium mt-1 text-sm"
          >
            {nextAppointment
              ? `Upcoming: ${nextAppointment.type} with ${nextAppointment.doctor} on ${nextAppointment.date}${nextAppointment.time ? ` at ${nextAppointment.time}` : ''}`
              : 'No upcoming appointments scheduled'}
          </motion.p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleRegenerate} disabled={isRegenerating} className="bg-blue-50 text-blue-600 px-5 py-2.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-100/50 disabled:opacity-70">
            {isRegenerating ? (
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            )}
            {isRegenerating ? 'Drafting...' : generatedPrep ? 'Regenerate AI Draft' : 'Generate AI Draft'}
          </button>
          <button onClick={handleExport} disabled={isGeneratingExport} className="bg-[#258bf8] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-[#1a7bed] transition-colors disabled:opacity-70">
            {isGeneratingExport ? (
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            )}
            {isGeneratingExport ? 'Generating...' : 'Export Summary'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Symptoms */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1"
        >
          <div className="flex items-center gap-2 mb-4 px-1 text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <h2 className="text-[15px] font-bold text-gray-900">Symptom & Vitals Summary (Last 30 Days)</h2>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Dynamic Logs & Symptoms */}
              {logs.slice(0, 3).map((log, idx) => (
                <div key={log.id} className={`${idx === 0 ? 'bg-[#fffdf2] border-[#fef0c7]' : 'bg-white border-gray-100'} border p-5 rounded-2xl flex gap-4 items-start shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow cursor-pointer`}>
                  <div className={`w-8 h-8 rounded-full ${idx === 0 ? 'bg-yellow-100 text-yellow-500' : 'bg-blue-50 text-blue-500'} flex items-center justify-center flex-shrink-0`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-[15px] mb-1">Diary Log {log.date}</h4>
                    <p className="text-[13px] font-medium text-gray-600 leading-relaxed">{log.text}</p>
                  </div>
                </div>
              ))}

              {customNotes.map((note) => (
                <div key={note.id} className="bg-white border border-gray-100 p-5 rounded-2xl flex gap-4 items-start shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow group/note">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-[15px] mb-1">Custom Note</h4>
                    <p className="text-[13px] font-medium text-gray-600 leading-relaxed">{note.text}</p>
                  </div>
                  <button onClick={() => removeCustomNote(note.id)} className="opacity-0 group-hover/note:opacity-100 transition-opacity text-gray-300 hover:text-red-400 flex-shrink-0 mt-1" aria-label="Remove note">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}

              {logs.length === 0 && customNotes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center h-full">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-900 mb-1">No symptoms logged</h3>
                  <p className="text-gray-500 text-[13px] font-medium max-w-[250px]">Your daily activity logs and custom notes will appear here to summarize for your doctor.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-50 bg-gray-50/30">
              <p className="text-[11px] font-bold text-gray-800 mb-3">+ Add manual symptom or note</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" value={newSymptom} onChange={e => setNewSymptom(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSymptom()} placeholder="e.g. Swelling in ankles..." className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none shadow-[0_2px_10px_rgb(0,0,0,0.02)] focus:border-gray-300 transition-colors placeholder:text-gray-400" />
                <button onClick={handleAddSymptom} className="bg-white border border-gray-200 text-gray-700 font-bold px-5 py-2.5 rounded-xl shadow-sm text-sm hover:bg-gray-50 transition-colors shrink-0">Save</button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Questions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="flex-1"
        >
          <div className="flex items-center gap-2 mb-4 px-1 text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <h2 className="text-[15px] font-bold text-gray-900">Discussion Agenda & Questions</h2>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col h-[500px]">
             <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              
              {/* If no logs, show empty state instead of hardcoded AI questions */}
              {logs.length === 0 && customQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center h-full">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-900 mb-1">Waiting for data</h3>
                  <p className="text-gray-500 text-[13px] font-medium max-w-[250px]">Record a daily log for AWS Bedrock to generate personalized questions for your doctor.</p>
                </div>
              ) : (
                <>
                  {generatedPrep && (
                    <div onClick={() => toggleQuestion(1)} className="bg-blue-50/40 border border-blue-100 p-5 rounded-2xl flex flex-col gap-2 cursor-pointer hover:bg-blue-50 transition-colors group">
                      <div className="flex gap-4 items-start">
                        <div className={`w-5 h-5 rounded border mt-0.5 flex-shrink-0 transition-colors ${expandedQuestions.includes(1) ? 'bg-blue-500 border-blue-500 flex items-center justify-center' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                          {expandedQuestions.includes(1) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            AI Suggestion
                          </p>
                          <p className="text-[14px] font-medium text-gray-800 leading-relaxed max-w-[90%]">{generatedPrep.question}</p>
                        </div>
                      </div>
                      {expandedQuestions.includes(1) && (
                        <div className="ml-9 mt-2 text-[12px] font-medium text-gray-500 bg-white/60 p-3 rounded-xl border border-blue-100/50">
                          <strong className="text-gray-700">Context:</strong> {generatedPrep.context}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dynamic Questions */}
                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 p-5 rounded-2xl flex gap-4 items-start shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                      <div className="w-5 h-5 rounded border-none bg-[#258bf8] text-white flex items-center justify-center mt-0.5 flex-shrink-0 shadow-inner">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-gray-800 leading-relaxed mt-0.5">{q}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}

            </div>
            
            <div className="p-6 border-t border-gray-50 bg-gray-50/30">
              <div className="relative">
                <input type="text" value={newQuestion} onChange={e => setNewQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddQuestion()} placeholder="Ask the doctor something..." className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-medium outline-none shadow-[0_2px_10px_rgb(0,0,0,0.02)] focus:border-gray-300 transition-colors placeholder:text-gray-400" />
                <button onClick={handleAddQuestion} className="absolute right-2 top-2 w-8 h-8 bg-[#258bf8] text-white rounded-lg flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      <motion.p 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center text-[11px] font-medium text-gray-400 mt-8 max-w-2xl mx-auto leading-relaxed"
      >
        Mimamori AI analyzes your daily logs to help you make the most of your 15-minute consultation. Everything here is editable to ensure your report accurately reflects your experience.
      </motion.p>

      {/* Export Summary Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#258bf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Visit Summary Draft
                </h2>
                {nextAppointment && (
                  <p className="text-xs text-gray-400 font-medium mt-0.5">{nextAppointment.type} with {nextAppointment.doctor} — {nextAppointment.date}</p>
                )}
              </div>
              <button onClick={() => setShowExportModal(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isGeneratingExport ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  <p className="text-sm font-bold text-gray-500 text-center">Analyzing your health data and generating summary...</p>
                  <p className="text-xs text-gray-400">This may take a few seconds</p>
                </div>
              ) : (
                <textarea
                  value={exportDraft}
                  onChange={e => setExportDraft(e.target.value)}
                  className="w-full min-h-[280px] bg-gray-50/50 border border-gray-200 rounded-2xl p-5 text-sm font-medium text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none"
                  placeholder="Your visit summary will appear here..."
                />
              )}
            </div>

            {/* AI refine bar */}
            {!isGeneratingExport && exportDraft && (
              <div className="px-4 sm:px-6 pb-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRefineExport()}
                    placeholder="Describe your edits..."
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleRefineExport}
                    disabled={!editPrompt.trim() || isRefiningExport}
                    className="bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-sm border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto"
                  >
                    {isRefiningExport ? (
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    )}
                    Refine
                  </button>
                </div>
              </div>
            )}

            {/* Modal footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-t border-gray-100 bg-gray-50/30 rounded-b-3xl">
              <p className="text-[10px] text-gray-400 font-medium order-2 sm:order-1">AI-generated — review before sharing</p>
              <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                <div className="relative flex-1 sm:flex-none">
                  <button onClick={handleCopyExport} disabled={!exportDraft || isGeneratingExport} className="w-full sm:w-auto bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                  </button>
                  {copyToast && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap">Copied!</span>
                  )}
                </div>
                <button onClick={handlePrintExport} disabled={!exportDraft || isGeneratingExport} className="flex-1 sm:flex-none bg-[#258bf8] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#1a7bed] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
