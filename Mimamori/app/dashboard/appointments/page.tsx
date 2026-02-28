'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { isAppointmentPast } from '@/lib/appointment-utils';
import Link from 'next/link';

export default function AppointmentsPage() {

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const { appointments, addAppointment, removeAppointment, logs, documents } = useAppContext();

  // Search & sort state
  const [apptSearchTerm, setApptSearchTerm] = useState('');
  const [apptSortOrder, setApptSortOrder] = useState<'newest' | 'oldest'>('newest');

  const displayedAppointments = useMemo(() => {
    const tabFiltered = activeTab === 'Upcoming'
      ? appointments.filter(a => !isAppointmentPast(a))
      : appointments.filter(a => isAppointmentPast(a));

    const searched = apptSearchTerm.trim()
      ? tabFiltered.filter(a => {
          const term = apptSearchTerm.toLowerCase();
          return a.doctor.toLowerCase().includes(term)
            || a.type.toLowerCase().includes(term)
            || a.dept.toLowerCase().includes(term)
            || a.notes?.toLowerCase().includes(term);
        })
      : tabFiltered;

    return searched.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      const safeA = Number.isNaN(timeA) ? 0 : timeA;
      const safeB = Number.isNaN(timeB) ? 0 : timeB;
      return apptSortOrder === 'newest' ? safeB - safeA : safeA - safeB;
    });
  }, [appointments, activeTab, apptSearchTerm, apptSortOrder]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSummaryError(null);
    setGeneratedSummary(null);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= ninetyDaysAgo;
      });
      const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));

      const res = await fetchWithRetry(
        '/api/medical-reasoning',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logs: recentLogs,
            documents: analyzedDocs,
            promptType: 'visit-prep'
          })
        },
        { maxRetries: 1, delayMs: 1000 }
      );

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedSummary(data.insight || 'No summary content returned.');
      setIsSummaryExpanded(true);
    } catch {
      setSummaryError('Unable to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({
    type: '',
    doctor: '',
    dept: '',
    date: '',
    time: '',
    room: '',
    isUpcoming: true,
    notes: ''
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAppointment(newAppt);
    setIsModalOpen(false);
    setNewAppt({ type: '', doctor: '', dept: '', date: '', time: '', room: '', isUpcoming: true, notes: '' });
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-4xl mx-auto min-w-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-10 gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            Appointments
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 font-medium mt-1 text-[15px]"
          >
            Manage your visits and preparation.
          </motion.p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Appointment
          </button>
          
          <div className="bg-white/50 backdrop-blur-md border border-white/50 rounded-full p-1.5 flex mt-1 shadow-sm">
          <button 
            onClick={() => setActiveTab('Upcoming')}
            className={`px-5 py-2 text-[13px] font-bold rounded-full transition-colors ${activeTab === 'Upcoming' ? 'text-white bg-[var(--color-brand-dark)] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >Upcoming</button>
          <button 
            onClick={() => setActiveTab('Past')}
            className={`px-5 py-2 text-[13px] font-bold rounded-full transition-colors ${activeTab === 'Past' ? 'text-white bg-[var(--color-brand-dark)] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >Past</button>
        </div>
        </div>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            type="text"
            value={apptSearchTerm}
            onChange={e => setApptSearchTerm(e.target.value)}
            placeholder="Search by doctor, type..."
            className="pl-9 pr-3 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-full transition-all"
            aria-label="Search appointments"
          />
        </div>
        <button
          onClick={() => setApptSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label={`Sort by ${apptSortOrder === 'newest' ? 'oldest first' : 'newest first'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"></path><path d="M11 9h7"></path><path d="M11 13h4"></path><path d="M3 17l3 3 3-3"></path><path d="M6 18V4"></path></svg>
          {apptSortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      <div className="space-y-8">
        
        {/* Dynamic Mapping */}
        {displayedAppointments.length === 0 && (
          <div className="text-center p-10 text-gray-500 font-medium glass-card rounded-3xl">
            {apptSearchTerm.trim()
              ? `No ${activeTab.toLowerCase()} appointments matching "${apptSearchTerm}"`
              : `No ${activeTab.toLowerCase()} appointments found.`}
          </div>
        )}

        {displayedAppointments.map(appt => {
          if (appt.isHero) {
            return (
              <motion.div 
                key={appt.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="glass-card rounded-[2rem] flex flex-col md:flex-row overflow-hidden relative"
              >
                {/* Left Side: Gradient */}
                <div className="w-full md:w-[40%] h-[320px] relative overflow-hidden bg-gradient-to-br from-[var(--color-brand-dark)] to-[#1C2951] flex-shrink-0">
                   <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE5YTEgMSAwIDAgMS0yIDB2LTRhMSAxIDAgMCAxIDIgMHY0em0tMTIgMGExIDEgMCAwIDEtMiAwdi00YTEgMSAwIDAgMSAyIDB2NHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                   
                   <div className="absolute bottom-6 left-6 right-6">
                      <div className="bg-white/20 backdrop-blur-md text-white border border-white/20 px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 mb-3">
                        <span className={`w-1.5 h-1.5 rounded-full ${appt.statusColor ? `bg-${appt.statusColor}-500` : 'bg-green-500'}`}></span> {appt.status || 'Scheduled'}
                      </div>
                      <h3 className="text-white font-bold text-[15px] leading-snug">{appt.notes || 'Medical Center'}</h3>
                      <p className="text-gray-300 font-medium text-xs mt-0.5">Room {appt.room || 'TBD'}, {appt.dept}</p>
                   </div>
                </div>

                {/* Right Side: Details */}
                <div className="flex-1 p-8 md:p-10 flex flex-col justify-center relative bg-transparent">
                  <div className="absolute top-8 right-8 w-16 h-16 bg-gray-50 rounded-full flex flex-col items-center justify-center border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{appt.date.split(' ')[0]}</span>
                    <span className="text-xl font-black text-gray-900 leading-none">{appt.date.split(' ')[1]}</span>
                  </div>

                  <p className="text-[#3ba53b] text-xs font-bold uppercase tracking-widest mb-2">Next Visit • Upcoming</p>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-6">{appt.type}</h2>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-8 mb-8 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white font-bold text-sm">
                        {appt.doctor.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{appt.doctor}</h4>
                        <p className="text-gray-500 font-medium text-[11px]">{appt.dept}</p>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <span className="text-sm font-medium">{appt.time}</span>
                    </div>
                    <button onClick={() => removeAppointment(appt.id)} className="absolute top-8 left-8 text-gray-300 hover:text-red-500 hover:bg-red-50 transition w-10 h-10 rounded-full flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"></path><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                    </button>
                  </div>

                  <div className="bg-[#effcf4] border border-[#d1fae5] rounded-[1.5rem] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm relative overflow-hidden group gap-4">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#a7f3d0]/30 rounded-full blur-[30px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
                    <div>
                      <h4 className="font-bold text-[#10b981] text-[15px] mb-1 flex items-center gap-1.5 text-shadow-sm">
                        ✨ AI Prep Summary
                      </h4>
                      <p className="text-gray-600 text-[13px] font-medium max-w-[280px] leading-relaxed relative z-10">Creates a 1-page report of your last 3 months to hand to your doctor.</p>
                    </div>
                    <button 
                      onClick={handleGenerate} 
                      disabled={isGenerating}
                      className="px-6 py-3 rounded-full font-bold text-sm shadow-md transition-all flex items-center gap-2 relative z-10 translate-y-0 bg-[#5ce14b] text-[#1e4a19] hover:bg-[#4dd23d] hover:shadow-lg hover:-translate-y-0.5 group border border-[#48c937]"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-[#1e4a19]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Summary
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </>
                      )}
                    </button>
                 </div>

                  {/* Summary Error */}
                  {summaryError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4 flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <p className="text-red-700 text-[13px] font-medium">{summaryError}</p>
                    </div>
                  )}

                  {/* Generated Summary Expandable Section */}
                  {generatedSummary && (
                    <div className="mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <button
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                          <span className="text-sm font-bold text-gray-900">AI Visit Prep Summary</span>
                        </div>
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`text-gray-400 transition-transform ${isSummaryExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      {isSummaryExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                          <div className="pt-3 text-[13px] font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {generatedSummary}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          }

          // Small list items
          return (
            <div key={appt.id} className={`bg-white border border-gray-100 ${appt.status === 'Canceled' ? 'opacity-60' : ''} rounded-3xl sm:rounded-full p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 shadow-[0_2px_15px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow relative group`}>
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 shadow-sm rounded-full flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{appt.date.split(' ')[0]}</span>
                <span className={`text-[17px] font-black ${appt.status === 'Canceled' ? 'text-gray-500' : 'text-gray-900'} leading-none`}>{appt.date.split(' ')[1]}</span>
              </div>
              <div className="flex-1 flex items-center justify-between pr-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className={`font-bold ${appt.status === 'Canceled' ? 'text-gray-600' : 'text-gray-900'} text-[15px]`}>{appt.type}</h4>
                    <span className={`${appt.status === 'Canceled' ? 'bg-gray-100 text-gray-500' : 'bg-[#d1fae5] text-[#10b981]'} px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider`}>{appt.status}</span>
                   </div>
                  <div className="flex items-center gap-3 text-[13px] font-medium text-gray-500">
                    <div className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> {appt.doctor}</div>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span>{appt.time}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Link href="/dashboard/visit-prep" className="bg-gray-50 hover:bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-[11px] font-bold transition-colors">Prep</Link>
                  <button onClick={() => removeAppointment(appt.id)} className="w-8 h-8 rounded-full text-red-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"></path><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* Add Appointment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Add New Appointment</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <form id="add-appt-form" onSubmit={handleAddSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Doctor Name</label>
                      <input required type="text" value={newAppt.doctor} onChange={e => setNewAppt({...newAppt, doctor: e.target.value})} placeholder="Doctor Name" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Visit Type</label>
                      <input required type="text" value={newAppt.type} onChange={e => setNewAppt({...newAppt, type: e.target.value})} placeholder="Visit Type" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Department</label>
                      <input required type="text" value={newAppt.dept} onChange={e => setNewAppt({...newAppt, dept: e.target.value})} placeholder="Department" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Date (e.g. Oct 24)</label>
                      <input required type="text" value={newAppt.date} onChange={e => setNewAppt({...newAppt, date: e.target.value})} placeholder="Date" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Time</label>
                      <input required type="text" value={newAppt.time} onChange={e => setNewAppt({...newAppt, time: e.target.value})} placeholder="Time" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium" />
                    </div>
                  </div>
                </form>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm">Cancel</button>
                <button type="submit" form="add-appt-form" className="bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all">Save Appointment</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
