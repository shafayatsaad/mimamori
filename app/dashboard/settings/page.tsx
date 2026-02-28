'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';

import { useAppContext } from '@/context/AppContext';

export default function SettingsPage() {
  const { patientProfile, settings, toggleNotificationSetting, updateSettings } = useAppContext();
  const [activeTab, setActiveTab] = useState('Account & Security');

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const tabs = ['Profile', 'Account & Security', 'Notifications', 'Billing', 'Integrations'];

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-4xl mx-auto pb-12 min-w-0">
      
      {/* Header */}
      <div className="mb-8">
        <motion.h1 
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="text-3xl font-black text-gray-900 tracking-tight"
        >
          Settings
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="text-gray-500 font-medium mt-1 text-[15px]"
        >
          Manage your account, privacy, and preferences.
        </motion.p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 sm:gap-8 border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar min-w-0">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm font-bold pb-3 border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab ? 'text-[#258bf8] border-[#258bf8]' : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'Account & Security' && (
            <div className="space-y-6">
              {/* Login & Security */}
              <div className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-100 p-8">
                <div className="flex flex-wrap justify-between items-start mb-8 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Login & Security</h2>
                    <p className="text-[13px] font-medium text-gray-500">Manage your password and 2-factor authentication.</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 text-blue-400 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-2">Email Address</label>
                    <div className="relative">
                      <input type="email" disabled defaultValue={patientProfile.email} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-medium text-gray-500 outline-none cursor-not-allowed" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[12px] font-bold text-gray-700 mb-2">Current Password</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="w-full bg-transparent border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-[14px] font-medium text-gray-900 outline-none focus:border-blue-300 transition-colors" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-gray-700 mb-2">New Password</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-transparent border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-[14px] font-medium text-gray-900 outline-none focus:border-blue-300 transition-colors" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-3">
                    <span className="bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">Coming Soon</span>
                    <button disabled title="Coming Soon — password change is not yet available" className="bg-gray-300 text-white px-8 py-3 rounded-full font-bold text-sm cursor-not-allowed opacity-60">Update Password</button>
                  </div>
                </div>

                <div className="w-full h-px bg-gray-100 my-8"></div>

                <div className="flex flex-wrap justify-between items-center bg-gray-50/50 p-6 rounded-2xl border border-gray-100 gap-3 min-w-0">
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm mb-0.5">Two-Factor Authentication</h3>
                      <p className="text-[12px] font-medium text-gray-500 max-w-sm">Additional security via code verification for login.</p>
                    </div>
                  </div>
                  <span className="bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">Coming Soon</span>
                </div>
              </div>

              {/* Data Privacy */}
              <div className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-100 p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6 font-black tracking-tight uppercase text-sm text-gray-400">Danger Zone</h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-red-100 bg-red-50/30 rounded-2xl gap-3 min-w-0">
                  <p className="text-sm font-medium text-gray-600">Permanently delete your account and all health history.</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">Coming Soon</span>
                    <button disabled title="Coming Soon — account deletion is not yet available" className="text-gray-400 font-bold text-sm cursor-not-allowed whitespace-nowrap">Delete Account</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notifications' && (
            <div className="space-y-6">
              <div className="bg-white rounded-[2rem] border border-gray-100 p-5 sm:p-8">
                <h2 className="text-sm font-black tracking-tight uppercase text-gray-400 mb-6">Alert Settings</h2>
                <div className="space-y-5">
                  {settings.notifications.map((item, idx) => {
                    // Merge default schedule for items that support it but were persisted without it
                    const defaultSchedules: Record<string, { day: string; time: string }> = {
                      'Daily Reminders': { day: 'Daily', time: '09:00' },
                      'Weekly Summaries': { day: 'Sunday', time: '18:00' },
                    };
                    const schedule = item.schedule ?? defaultSchedules[item.title] ?? null;

                    return (
                    <div key={idx} className="flex items-start gap-4 justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          {schedule && item.active
                            ? `Receive a report every ${schedule.day === 'Daily' ? 'day' : schedule.day} at ${schedule.time ? new Date(`2000-01-01T${schedule.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '9:00 AM'}.`
                            : item.desc}
                        </p>
                        {schedule && item.active && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <select
                              value={schedule.day ?? 'Daily'}
                              onChange={e => {
                                const updated = [...settings.notifications];
                                updated[idx] = { ...updated[idx], schedule: { ...schedule, day: e.target.value } };
                                updateSettings({ notifications: updated });
                              }}
                              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-400 transition-colors"
                              aria-label={`${item.title} day`}
                            >
                              <option value="Daily">Daily</option>
                              <option value="Monday">Monday</option>
                              <option value="Tuesday">Tuesday</option>
                              <option value="Wednesday">Wednesday</option>
                              <option value="Thursday">Thursday</option>
                              <option value="Friday">Friday</option>
                              <option value="Saturday">Saturday</option>
                              <option value="Sunday">Sunday</option>
                            </select>
                            <span className="text-xs text-gray-400 font-medium">at</span>
                            <input
                              type="time"
                              value={schedule.time ?? '09:00'}
                              onChange={e => {
                                const updated = [...settings.notifications];
                                updated[idx] = { ...updated[idx], schedule: { ...schedule, time: e.target.value } };
                                updateSettings({ notifications: updated });
                              }}
                              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-blue-400 transition-colors"
                              aria-label={`${item.title} time`}
                            />
                          </div>
                        )}
                      </div>
                      <div
                        role="switch"
                        aria-checked={item.active}
                        aria-label={`Toggle ${item.title}`}
                        onClick={() => toggleNotificationSetting(idx)}
                        className={`w-11 h-6 rounded-full relative cursor-pointer border transition-colors flex-shrink-0 mt-0.5 ${item.active ? 'bg-blue-500 border-blue-600' : 'bg-gray-200 border-gray-300'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${item.active ? 'right-0.5' : 'left-0.5'}`}></div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-8">
              <div className="flex flex-wrap justify-between items-start mb-8 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Current Plan</h2>
                  <p className="text-sm font-medium text-gray-500">Your plan details and billing cycle.</p>
                </div>
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100">Active</span>
              </div>
              
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 mb-8">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                  <span className="text-sm font-bold text-gray-600 uppercase tracking-wider text-[11px]">Plan Name</span>
                  <span className="text-lg font-black text-gray-900 tracking-tight">Standard Family</span>
                </div>
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                  <span className="text-sm font-bold text-gray-600 uppercase tracking-wider text-[11px]">Monthly Cost</span>
                  <span className="text-lg font-black text-gray-900 tracking-tight">$0.00 <span className="text-xs font-medium text-gray-400 ml-1">(No charge)</span></span>
                </div>
                <div className="w-full h-px bg-gray-200/50 my-4"></div>
                <p className="text-xs font-medium text-gray-500 leading-relaxed italic">
                  * All medical features are currently active.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-6 py-3 rounded-xl font-bold text-sm cursor-not-allowed">
                  Manage Payments
                  <span className="bg-gray-200/60 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Coming Soon</span>
                </span>
              </div>
            </div>
          )}

          {(activeTab === 'Profile' || activeTab === 'Integrations') && (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6">
                 {activeTab === 'Profile' ? (
                   <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                 ) : (
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                 )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Manage {activeTab}</h2>
              <p className="text-sm font-medium text-gray-500 max-w-sm mb-8">
                {activeTab === 'Profile' ? 'Update your personal details and medical information in the dedicated profile section.' : 'Connect with external health data sources to enrich your dashboard.'}
              </p>
              {activeTab === 'Profile' ? (
                <Link 
                  href="/dashboard/profile"
                  className="bg-blue-50 text-blue-600 px-8 py-3 rounded-full font-bold text-sm hover:bg-blue-100 transition-colors"
                >
                  Go to Profile
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-8 py-3 rounded-full font-bold text-sm cursor-not-allowed">
                  Configure Integrations
                  <span className="bg-gray-200/60 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Coming Soon</span>
                </span>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
