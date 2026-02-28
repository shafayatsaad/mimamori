'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

export default function PatientsPage() {
  const router = useRouter();
  const { linkedPatients, selectPatient, loginAsCaregiver, currentUserType } = useAppContext();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsJoining(true);
    setError('');
    const success = await loginAsCaregiver(code.trim());
    setIsJoining(false);
    if (success) {
      setCode('');
      setShowAddForm(false);
    } else {
      setError('Invalid or expired invitation code');
    }
  };

  const handleSelect = async (email: string) => {
    await selectPatient(email);
    router.push('/dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Patients</h1>
            <p className="text-sm text-gray-400 font-medium mt-1">Select a patient to view their dashboard</p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Patient
            </button>
          )}
        </div>

        {/* Add Patient Form */}
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card rounded-2xl p-6 mb-6 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Connect to a Patient</h3>
                <p className="text-[11px] text-gray-400">Enter the invitation code shared by the patient</p>
              </div>
            </div>
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-bold tracking-widest uppercase text-center placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={isJoining || !code.trim()}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setError(''); setCode(''); }}
                className="px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </form>
            {error && (
              <p className="text-red-500 text-xs font-bold mt-3">{error}</p>
            )}
          </motion.div>
        )}

        {/* Patient Cards */}
        {linkedPatients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {linkedPatients.map((patient) => (
              <button
                key={patient.email}
                onClick={() => handleSelect(patient.email)}
                className="glass-card rounded-2xl p-6 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-black text-blue-500/70">
                      {(patient.name || patient.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors truncate">
                      {patient.name || 'Patient'}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium truncate">{patient.email}</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">No patients yet</h3>
            <p className="text-sm text-gray-400 mb-6">Ask a patient to share their invitation code with you</p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm"
              >
                Add Your First Patient
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
