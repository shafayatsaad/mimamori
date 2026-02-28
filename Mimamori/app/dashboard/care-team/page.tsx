'use client';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { checkInactivity } from '@/lib/critical-alerts';

export default function CareTeamPage() {
  const { caregivers, invitations, removeCaregiver, logs, patientProfile, currentUserType } = useAppContext();
  const inactivityHours = checkInactivity(logs);
  const patientName = patientProfile?.name || 'the patient';
  const [alertEmail, setAlertEmail] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // Caregivers with emails (from invitations)
  const caregiverEmails = invitations
    .filter(inv => inv.email && inv.email.trim() !== '')
    .map(inv => ({ name: inv.name, email: inv.email }));

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateDraftFromSelected = () => {
    const selected = logs.filter(l => selectedLogIds.has(l.id));
    if (selected.length === 0) return;
    const lines = selected.map(l => {
      const label = /mg|med|taken|pill|dose/i.test(l.text) ? '💊 Medication' :
        l.entities?.some((e: any) => e.Category === 'MEDICAL_CONDITION' || e.Category === 'ANATOMY') ? '⚠️ Health Indicator' : '📋 Check-in';
      const text = l.text.length > 120 ? l.text.substring(0, 120) + '...' : l.text;
      return `${label} (${l.date}):\n  ${text}`;
    });
    const draft = `🏥 MIMAMORI HEALTH UPDATE\n\n👤 Patient: ${patientProfile?.name || 'Your loved one'}\n\n📝 Selected Activity Summary:\n\n${lines.join('\n\n')}\n\n🔔 Please review the patient dashboard for full details.`;
    setAlertMessage(draft);
  };
  
  const removeMember = (id: string) => {
    if (window.confirm('Are you sure you want to remove this member from your care team?')) {
      removeCaregiver(id);
    }
  };

  const handleSendAlert = async () => {
    setIsSendingAlert(true);
    setAlertStatus(null);
    try {
      const defaultMsg = `🏥 MIMAMORI HEALTH ALERT\n\n📋 Status: Routine Check-In Required\n👤 Patient: ${patientProfile?.name || 'Your loved one'}\n\n⚠️ Flagged Symptoms:\n• Recent health probes indicate changes in daily patterns\n• AI analysis recommends caregiver review\n\n🔔 Action Required:\n• Review patient dashboard for detailed metrics\n• Confirm medication was taken today`;
      const finalMsg = alertMessage.trim() || defaultMsg;
      
      const res = await fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: alertEmail.trim(),
          message: finalMsg
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setAlertStatus('✓ Alert sent successfully!');
        setAlertEmail('');
        setAlertMessage('');
        setSelectedLogIds(new Set());
      } else {
        setAlertStatus('✗ Failed to send: ' + (data.error || 'Unknown error'));
      }
    } catch {
      setAlertStatus('✗ Network error. Try again.');
    } finally {
      setIsSendingAlert(false);
      setTimeout(() => {
         setAlertStatus(null);
         (document.getElementById('alert-modal') as any)?.close?.();
      }, 4000);
    }
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-5xl mx-auto min-w-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="shrink-0">
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            My Care Team
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 font-medium mt-1 text-sm"
          >
            Manage who has access to health data and alerts.
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setIsSendingAlert(false); setAlertStatus(null); setSelectedLogIds(new Set()); (document.getElementById('alert-modal') as any)?.showModal?.(); }}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Send Alert
          </button>
          <Link href="/dashboard/care-team/add" className="bg-[#eff4ec] text-[#2c3f25] px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#e1ebd9] transition-colors shadow-sm cursor-pointer whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add New Caregiver
          </Link>
        </div>
      </div>

      {/* Patient Inactivity Warning — visible to caregivers only */}
      {currentUserType === 'Caregiver' && inactivityHours > 48 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-300 text-red-700 text-sm font-bold px-4 py-3 rounded-2xl mb-6 flex items-center gap-2"
          data-testid="inactivity-red-alert"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
          </svg>
          No activity from {patientName} in over 48 hours — consider checking in
        </motion.div>
      )}
      {currentUserType === 'Caregiver' && inactivityHours > 24 && inactivityHours <= 48 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-300 text-amber-700 text-sm font-bold px-4 py-3 rounded-2xl mb-6 flex items-center gap-2"
          data-testid="inactivity-amber-warning"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
          </svg>
          No activity from {patientName} in over 24 hours
        </motion.div>
      )}

      {/* Alert Modal */}
      <AnimatePresence>
        {alertEmail !== null && (
          <dialog id="alert-modal" className="bg-transparent backdrop:bg-black/40 backdrop:backdrop-blur-sm p-0 rounded-3xl max-w-lg w-full">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </span>
                  Send Email Alert
                </h3>
                <button onClick={() => (document.getElementById('alert-modal') as any)?.close?.()} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="space-y-3">
                {/* Quick-fill caregiver emails */}
                {caregiverEmails.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quick Fill</p>
                    <div className="flex flex-wrap gap-1.5">
                      {caregiverEmails.map((cg, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAlertEmail(cg.email)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${alertEmail === cg.email ? 'bg-red-50 border-red-300 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                          {cg.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="Caregiver Email Address" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-200 placeholder:text-gray-300" />

                {/* Recent activity selection */}
                {logs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Select Recent Activity</p>
                    <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                      {logs.slice(0, 8).map(log => {
                        const checked = selectedLogIds.has(log.id);
                        const isMed = /mg|med|taken|pill|dose/i.test(log.text);
                        const isCondition = log.entities?.some((e: any) => e.Category === 'MEDICAL_CONDITION' || e.Category === 'ANATOMY');
                        const emoji = isMed ? '💊' : isCondition ? '⚠️' : '📋';
                        return (
                          <label key={log.id} className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-red-50/60' : 'hover:bg-white'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLogSelection(log.id)}
                              className="mt-0.5 accent-red-500 rounded"
                            />
                            <span className="text-[11px] font-medium text-gray-600 leading-snug">
                              {emoji} <span className="text-gray-400">{log.date}</span> — {log.text.length > 60 ? log.text.substring(0, 60) + '...' : log.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {selectedLogIds.size > 0 && (
                      <button
                        type="button"
                        onClick={generateDraftFromSelected}
                        className="mt-1.5 w-full text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Generate Draft from {selectedLogIds.size} item{selectedLogIds.size > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}

                <textarea value={alertMessage} onChange={e => setAlertMessage(e.target.value)} placeholder="Custom message (optional)" rows={alertMessage.length > 100 ? 5 : 2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-200 placeholder:text-gray-300 resize-none" />
                <button 
                  onClick={handleSendAlert} disabled={isSendingAlert || !alertEmail.trim()}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] flex items-center gap-2 justify-center"
                >
                  {isSendingAlert ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                  {isSendingAlert ? 'Sending...' : 'Send Alert Email'}
                </button>
                {alertStatus && <p className={`text-center text-xs font-bold ${alertStatus.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{alertStatus}</p>}
              </div>
            </div>
          </dialog>
        )}
      </AnimatePresence>


      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <AnimatePresence mode="popLayout">
          {caregivers.map((member) => (
            <motion.div 
              key={member.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col overflow-hidden h-auto min-h-[300px]"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 relative">
                      <Image src={member.image} alt={member.name} fill className="object-cover" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm z-10">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{member.name}</h3>
                      <p className="text-[#3ba53b] text-xs font-bold tracking-wide">{member.role}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeMember(member.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors group flex items-center gap-1.5"
                    title="Remove member"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden group-hover:block">Remove</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 1-2 0-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>

                {/* Permissions Checklist */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">Access Permissions</p>
                  <ul className="space-y-1.5">
                    {['Diary', 'Alerts', 'Vault'].map(perm => {
                      const hasPerm = member.permissions?.includes(perm as any);
                      return (
                        <li key={perm} className="flex items-center gap-2 text-[11px] font-bold">
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${hasPerm ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-300'}`}>
                            {hasPerm ? (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            )}
                          </div>
                          <span className={hasPerm ? 'text-gray-700' : 'text-gray-400 line-through decoration-gray-300'}>
                             {perm === 'Diary' ? 'Daily Health Logs' : perm === 'Alerts' ? 'Emergency Alerts' : 'Document Vault'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

              </div>
              <div className="bg-gray-50 p-4 flex items-center justify-between border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-[#128C7E]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span className="text-[9px] font-bold uppercase tracking-widest">Integration Active</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-gray-100 shadow-sm">
                  {member.integration === 'WhatsApp' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.06-.297-.15-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.295-.018-.458.13-.606.134-.135.297-.347.446-.52.151-.174.2-.298.3-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.566-.01c-.2 0-.52.074-.792.372-.271.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  )}
                  <span className={`text-[10px] font-bold ${member.integration === 'WhatsApp' ? 'text-[#128C7E]' : 'text-gray-600'}`}>
                    {member.integration}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Connect New Member */}
        <Link href="/dashboard/care-team/add" className="bg-white rounded-[1.5rem] border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center p-8 text-center cursor-pointer group min-h-[300px]">
          <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          <h3 className="font-bold text-gray-700 text-lg mb-2">Connect a new member</h3>
          <p className="text-gray-400 text-[13px] font-medium max-w-[200px] leading-relaxed">
            Invite family or doctors to coordinate care seamlessly.
          </p>
        </Link>
      </div>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Pending Invitations <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full inline-block ml-1 animate-pulse"></span>
            </h3>
          </div>
          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Secret Code</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invite, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-gray-900 text-[14px]">{invite.name}</td>
                    <td className="py-4 px-6 text-[13px] font-medium text-gray-500">{invite.role}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="bg-blue-50 text-blue-600 font-mono font-bold tracking-[0.2em] px-3 py-1.5 rounded-lg text-sm border border-blue-100 shadow-sm">{invite.code}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-100 uppercase tracking-wider">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Waiting
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Activity Log */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2 shrink-0">
            Recent Alerts & Activity <span className="w-2.5 h-2.5 bg-[#3ba53b] rounded-full inline-block ml-1"></span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="bg-[#4cdf28] text-white px-4 py-1.5 rounded-full text-[12px] font-bold shadow-sm whitespace-nowrap">All</button>
            <button disabled title="Coming Soon" className="bg-white border border-gray-200 text-gray-400 px-4 py-1.5 rounded-full text-[12px] font-bold cursor-not-allowed opacity-60 relative group whitespace-nowrap">AI Insights ✨
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Coming Soon</span>
            </button>
            <button disabled title="Coming Soon" className="bg-white border border-gray-200 text-gray-400 px-4 py-1.5 rounded-full text-[12px] font-bold cursor-not-allowed opacity-60 relative group whitespace-nowrap">Medications 💊
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Coming Soon</span>
            </button>
            <button disabled title="Coming Soon" className="bg-white border border-gray-200 text-gray-400 px-4 py-1.5 rounded-full text-[12px] font-bold cursor-not-allowed opacity-60 relative group whitespace-nowrap">Vitals 🩺
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Coming Soon</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {logs.length > 0 ? logs.slice(0, 5).map(log => {
              const isMed = /mg|med|taken|pill|dose/i.test(log.text) || log.entities?.some(e => e.Category === 'MEDICATION');
              const isAlert = log.entities?.some(e => e.Category === 'MEDICAL_CONDITION' || e.Category === 'ANATOMY');
              
              const item = isAlert ? {
                id: log.id,
                title: 'Health Indicator Logged',
                time: log.date,
                desc: log.text.length > 60 ? log.text.substring(0, 60) + '...' : log.text,
                type: 'alert',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
                bg: 'bg-[#fffdf2] border-[#fef0c7]',
                iconBg: 'bg-[#fef0c7] text-[#e08905]',
                status: (
                  <div className="flex items-center gap-1.5 bg-white border border-gray-100 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm text-brand-green">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Care Team Notified
                  </div>
                )
              } : isMed ? {
                id: log.id,
                title: 'Medication Logged',
                time: log.date,
                desc: log.text.length > 60 ? log.text.substring(0, 60) + '...' : log.text,
                type: 'log',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
                bg: 'bg-white border-gray-100',
                iconBg: 'bg-blue-50 text-blue-500',
                status: (
                   <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-500 px-2.5 py-1 rounded shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Logged
                   </div>
                )
              } : {
                id: log.id,
                title: 'Daily Check-in',
                time: log.date,
                desc: log.text.length > 60 ? log.text.substring(0, 60) + '...' : log.text,
                type: 'report',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
                bg: 'bg-white border-gray-100',
                iconBg: 'bg-gray-50 text-gray-400',
                status: <div className="w-2 h-2 rounded-full bg-gray-200"></div>
              };

              return (
              <motion.div 
                key={item.id}
                layout
                className={`${item.bg} border p-4 sm:p-5 rounded-[1.5rem] flex gap-3 sm:gap-5 items-start shadow-sm transition-all hover:shadow-md`}
              >
                <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                    <h4 className="font-bold text-gray-900 text-[15px]">{item.title}</h4>
                    <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">{item.time}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{item.desc}</p>
                  <div className="flex items-center">
                    {item.status}
                  </div>
                </div>
              </motion.div>
              );
            }) : (
              <div className="text-center py-8 text-sm font-medium text-gray-500 bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                No recent alerts or activity.
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

    </div>
  );
}
