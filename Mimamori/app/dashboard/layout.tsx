'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useState, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNavigationItems, filterNavigationItems } from '@/lib/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import NotificationBell from '@/components/NotificationBell';

/** Map from iconId to SVG JSX — keeps icons in code since JSON can't store JSX */
const iconMap: Record<string, ReactNode> = {
  patients: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  'daily-log': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  'health-trends': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
  'care-team': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  documents: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  appointments: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  'visit-prep': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
};

const allNavItems = getNavigationItems();

function DashboardInner({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { currentUserType, currentCaregiverId, caregivers, patientProfile, logout } = useAppContext();

  const isCaregiver = currentUserType === 'Caregiver';
  const caregiver = isCaregiver ? caregivers.find(c => c.id === currentCaregiverId) : null;
  const perms = caregiver?.permissions || [];

  const userType = isCaregiver ? 'Caregiver' : 'Patient';

  // Filter nav items from config — separate main nav from settings
  const filteredItems = useMemo(
    () => filterNavigationItems(allNavItems, userType, perms),
    [userType, perms]
  );
  const navItems = filteredItems.filter((item) => item.iconId !== 'settings');
  const settingsItem = filteredItems.find((item) => item.iconId === 'settings');

  return (
      <div className="flex flex-col md:flex-row h-[100dvh] bg-[#f8fafc] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-emerald-50/30 to-indigo-50/40 font-sans overflow-hidden">
        
        {/* Mobile Top Bar */}
        <div className="md:hidden glass-card flex items-center justify-between p-4 z-30 sticky top-0 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={40} height={40} className="object-contain" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">Mimamori</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 glass-card border-none flex flex-col justify-between py-6 h-[100dvh] transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} flex-shrink-0`}>
          <div>
            {/* Logo */}
            <div className="flex items-center justify-between px-6 mb-10">
              <Link href="/dashboard" className="flex items-center gap-3">
                <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={40} height={40} className="object-contain" />
                <span className="text-xl font-bold text-gray-900 tracking-tight">Mimamori</span>
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className={`${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                      {iconMap[item.iconId]}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Settings — shown only when config allows for this user type */}
            {settingsItem && (
              <div className="px-3 mt-6">
                <Link
                  href={settingsItem.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all"
                >
                  <span className="text-gray-400">
                    {iconMap[settingsItem.iconId]}
                  </span>
                  {settingsItem.name}
                </Link>
              </div>
            )}
          </div>

          {/* User Profile & Log Out */}
          <div className="px-5 flex flex-col gap-4">
            <Link href={isCaregiver ? "/dashboard/patients" : "/dashboard/profile"} className="flex flex-col xl:flex-row items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100/80 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group">
              <div className="w-12 h-12 xl:w-10 xl:h-10 rounded-full bg-blue-100 overflow-hidden relative border-2 border-transparent group-hover:border-blue-200 transition-colors shrink-0 flex items-center justify-center">
                {isCaregiver ? (
                  <Image src={caregiver?.image || "/images/family-care-photo-hd.png"} alt="User Profile" fill className="object-cover object-top" />
                ) : patientProfile.image ? (
                  <Image src={patientProfile.image} alt="User Profile" fill className="object-cover object-top" />
                ) : (
                  <span className="text-xl font-black text-blue-500/50">{patientProfile.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <div className="hidden xl:block flex-1 min-w-0">
                  <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {isCaregiver ? (caregiver?.selfName || caregiver?.name) : patientProfile.name}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-0.5 group-hover:text-blue-500 transition-colors">
                    {isCaregiver ? 'Caregiver Account' : 'Patient Account'}
                  </p>
              </div>
              {!isCaregiver && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden xl:block text-gray-400 group-hover:text-blue-500 transition-colors shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>}
            </Link>
            
            <button 
               onClick={() => { logout(); router.push('/'); }}
               className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 w-full text-left"
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
               Log Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative w-full min-w-0">
          <div className="hidden md:flex justify-end px-8 pt-6">
            <NotificationBell />
          </div>
          <div className="w-full max-w-5xl mx-auto p-4 md:p-8 lg:p-12 md:pt-2">
            {children}
          </div>
        </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <DashboardInner>{children}</DashboardInner>
    </ErrorBoundary>
  );
}
