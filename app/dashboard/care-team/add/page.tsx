'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { useAppContext, CaregiverPermission } from '@/context/AppContext';

export default function AddCaregiverPage() {
  const { generateInviteCode } = useAppContext();
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState({ diary: true, alerts: true, vault: false });
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) {
      setErrorMsg('Please enter both name and relationship to create an invitation.');
      return;
    }
    setErrorMsg('');
    
    const perms: CaregiverPermission[] = [];
    if (permissions.diary) perms.push('Diary');
    if (permissions.alerts) perms.push('Alerts');
    if (permissions.vault) perms.push('Vault');

    const caregiverEmail = email || 'caregiver@example.com';
    const code = generateInviteCode({
      name,
      role: role.charAt(0).toUpperCase() + role.slice(1),
      email: caregiverEmail,
      permissions: perms
    });

    if (email) {
       try {
         await fetch('/api/caregiver/verify-email', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: caregiverEmail })
         });
         setVerificationSent(true);
       } catch (err) {
         console.error("Failed to send verification email", err);
       }
    }

    setInviteCode(code);
  };

  if (inviteCode) {
    return (
      <div className="w-full h-full flex justify-center items-center py-10">
        <div className="w-full max-w-[500px]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 text-center">
             <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <h2 className="text-2xl font-black text-gray-900 mb-2">Invitation Created</h2>
             <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">Share this secure code with <strong className="text-gray-900">{name}</strong>. They will enter it when creating their caregiver account to connect to your care team.</p>
             
             {verificationSent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6 text-left flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500 shrink-0 mt-0.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 text-left">Email Verification Sent</h4>
                    <p className="text-xs text-gray-500 mt-0.5 max-w-[340px]">An official verification email has been sent to the caregiver's inbox to authorize alerts. They must click the link to receive future notifications.</p>
                  </div>
                </motion.div>
             )}

             <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-10 shadow-inner">
               <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Secret Code</p>
               <div className="text-4xl font-black tracking-[0.2em] text-[#258bf8] font-mono">{inviteCode}</div>
             </div>

             <Link href="/dashboard/care-team" className="inline-block w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-colors shadow-lg">
               Done 
             </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex justify-center py-4">
      
      <div className="w-full max-w-[500px]">
        
        {/* Back Link */}
        <Link href="/dashboard/care-team" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </Link>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-10 mb-8 flex flex-col relative overflow-hidden"
        >
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Add New Caregiver</h1>
            <p className="text-gray-500 text-[13px] font-medium leading-relaxed">Invite a family member or nurse to help monitor your loved one.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Miller" className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium placeholder:text-gray-400 placeholder:font-normal" />
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-2">Relationship</label>
              <div className="relative">
                <select value={role} onChange={e => setRole(e.target.value)} className="appearance-none w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium text-gray-700 bg-white">
                  <option defaultValue="">Select relationship</option>
                  <option value="daughter">Daughter</option>
                  <option value="son">Son</option>
                  <option value="spouse">Spouse</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="other">Other</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>

            {/* Contact & Alerts */}
            <div className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-bold text-gray-900 text-[15px]">Contact & Alerts</h3>
                <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">Required</span>
              </div>
              
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Email Address</label>
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="caregiver@example.com" className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium placeholder:text-gray-400 placeholder:font-normal" />
                </div>
              </div>

              <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-2xl p-4 flex gap-4 items-start shadow-sm mb-6">
                <div className="bg-white p-2 rounded-full shadow-sm text-blue-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 text-sm mb-1">Email Alerts</h4>
                  <p className="text-gray-600 text-[11px] font-medium leading-relaxed">Send critical AI alerts (falls, worsening conditions) to this email instantly via AWS SES.</p>
                </div>
                <div className="flex items-center h-full pt-1">
                   <div className="w-5 h-5 rounded border border-blue-500 bg-blue-500 text-white flex items-center justify-center shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                   </div>
                </div>
              </div>
            </div>

            {/* Access & Permissions */}
            <div className="pt-2">
              <h3 className="font-bold text-gray-900 text-[15px] mb-5">Access & Permissions</h3>
              
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  <div className="bg-gray-50 p-2 rounded-lg text-gray-500 border border-gray-100 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">Share Daily Diary</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">Allow this person to view daily summary logs and activity timelines.</p>
                  </div>
                  <div 
                    onClick={() => setPermissions(p => ({...p, diary: !p.diary}))}
                    className={`w-10 h-6 rounded-full relative shadow-inner cursor-pointer flex-shrink-0 transition-colors ${permissions.diary ? 'bg-blue-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transform transition-transform ${permissions.diary ? 'top-0.5 right-0.5' : 'top-0.5 left-0.5'}`}></div>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="bg-gray-50 p-2 rounded-lg text-gray-500 border border-gray-100 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">App Notifications</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">Notify their Mimamori app when unusual activity is detected.</p>
                  </div>
                  <div 
                    onClick={() => setPermissions(p => ({...p, alerts: !p.alerts}))}
                    className={`w-10 h-6 rounded-full relative shadow-inner cursor-pointer flex-shrink-0 transition-colors ${permissions.alerts ? 'bg-blue-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transform transition-transform ${permissions.alerts ? 'top-0.5 right-0.5' : 'top-0.5 left-0.5'}`}></div>
                  </div>
                </div>

                <div className="flex gap-4 items-start pb-4">
                  <div className="bg-gray-50 p-2 rounded-lg text-gray-500 border border-gray-100 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">Document Vault Access</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">Grant secure access to view medical records and insurance info.</p>
                  </div>
                  <div 
                    onClick={() => setPermissions(p => ({...p, vault: !p.vault}))}
                    className={`w-10 h-6 rounded-full relative shadow-inner cursor-pointer flex-shrink-0 transition-colors ${permissions.vault ? 'bg-blue-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transform transition-transform ${permissions.vault ? 'top-0.5 right-0.5' : 'top-0.5 left-0.5'}`}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              {errorMsg && (
                <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-3 rounded-xl mb-4 text-center border border-red-100">
                  {errorMsg}
                </div>
              )}
              <button type="submit" className="w-full bg-[#258bf8] text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                Send Invite & Save Preferences 
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <p className="text-center text-[10px] font-bold text-gray-400 mt-4 tracking-wide">
                They will receive an email with instructions to join.
              </p>
            </div>

          </form>
        </motion.div>
      </div>
    </div>
  );
}
