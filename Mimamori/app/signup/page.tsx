'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SignupPage() {
  const router = useRouter();
  const { loginAsCaregiver } = useAppContext();
  const t = useTranslations('signup');
  const [role, setRole] = useState<'patient' | 'caregiver'>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Forcefully clear all local storage to guarantee a clean slate for new signups
    localStorage.clear();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (role === 'patient') {
      if (!name || !email || !password) {
        setErrorMsg(t('fillAllFields'));
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role: 'patient' })
        });
        const data = await res.json();
        if (res.ok) {
           router.push('/login');
        } else {
           setErrorMsg(data.error || t('signupFailed'));
        }
      } catch (err) {
        setErrorMsg(t('genericError'));
      } finally {
        setIsLoading(false);
      }
    } else {
        if (!name || !email || !password) {
          setErrorMsg(t('fillAllFields'));
          return;
        }

        setIsLoading(true);

        if (code.trim()) {
          const success = await loginAsCaregiver(code, name);
          setIsLoading(false);
          if (success) {
            router.push('/dashboard/patients');
          } else {
            setErrorMsg(t('invalidCode'));
          }
        } else {
          try {
            const res = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, password, role: 'caregiver' })
            });
            const data = await res.json();
            if (res.ok) {
              router.push('/login');
            } else {
              setErrorMsg(data.error || t('signupFailed'));
            }
          } catch (err) {
            setErrorMsg(t('genericError'));
          } finally {
            setIsLoading(false);
          }
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center font-sans overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         {/* Subtle background rings similar to login page */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-gray-200/50 rounded-full" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-gray-200/30 rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-6xl w-full bg-white rounded-[2rem] shadow-xl border border-gray-100 flex flex-col md:flex-row relative z-10 overflow-hidden"
      >
        {/* Left Side: Branding and Context */}
        <div className={`w-full md:w-1/2 p-10 md:p-14 border-r border-gray-50 flex flex-col transition-colors duration-500 ${role === 'caregiver' ? 'bg-[#edfcf2]' : 'bg-[#fafafa]'}`}>
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-12">
            <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={40} height={40} className="object-contain" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">Mimamori</span>
          </Link>

          {/* Hero Image */}
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden mb-10 shadow-sm border border-gray-100">
            <Image
              src="/images/family-care-photo-hd.png"
              alt="Caregiver and patient smiling"
              fill
              className="object-cover object-top scale-110"
            />
          </div>

          {/* Quote / Copy */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              {role === 'patient' ? (
                <motion.div
                  key="patient-copy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-[28px] leading-tight font-bold italic text-gray-900 tracking-tight font-serif text-balance mb-4">
                    {t('patientQuoteLine1')}<br/>{t('patientQuoteLine2')}
                  </h2>
                  <p className="text-gray-600 font-medium text-[15px] leading-relaxed max-w-sm">
                    {t('patientSubtext')}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="caregiver-copy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-[28px] leading-tight font-bold italic text-gray-900 tracking-tight font-serif text-balance mb-4">
                    {t('caregiverHeadlineLine1')}<br/>{t('caregiverHeadlineLine2')}
                  </h2>
                  <p className="text-gray-600 font-medium text-[15px] leading-relaxed max-w-sm">
                    {t('caregiverSubtext')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-10 md:p-16 flex flex-col justify-center bg-white">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
              {role === 'patient' ? t('titlePatient') : t('titleCaregiver')}
            </h1>
            <p className="text-gray-500 text-sm">
              {role === 'patient' ? t('subtitlePatient') : t('subtitleCaregiver')}
            </p>
          </div>

          {/* Role Toggle */}
          <div className="w-full bg-gray-50 p-1 rounded-[1.2rem] flex mb-10 border border-gray-200/60">
            <button 
              onClick={() => setRole('patient')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${role === 'patient' ? 'bg-white text-blue-500 shadow-[0_2px_10px_rgb(0,0,0,0.06)]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              I am a Patient
            </button>
            <button 
              onClick={() => setRole('caregiver')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${role === 'caregiver' ? 'bg-white text-blue-500 shadow-[0_2px_10px_rgb(0,0,0,0.06)]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              I am a Caregiver
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label className="block text-[13px] font-bold text-gray-900 mb-2">{t('fullNameLabel')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={role === 'patient' ? t('fullNamePlaceholderPatient') : t('fullNamePlaceholderCaregiver')} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400" />
            </div>
            
            <div>
              <label className="block text-[13px] font-bold text-gray-900 mb-2">{t('emailLabel')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={role === 'patient' ? t('emailPlaceholderPatient') : t('emailPlaceholderCaregiver')} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400" />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-gray-900 mb-2">{t('passwordLabel')}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={role === 'patient' ? t('passwordPlaceholderPatient') : t('passwordPlaceholderCaregiver')} className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {role === 'caregiver' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gray-50/80 border border-gray-200/80 rounded-2xl p-5 mt-6 overflow-hidden"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-[13px]">{t('connectToPatient')}</h4>
                    <p className="text-gray-500 text-[11px]">{t('enterCode')}</p>
                  </div>
                </div>
                <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder={t('codePlaceholder')} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-bold tracking-widest uppercase text-center placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400 placeholder:text-center bg-white" />
                <p className="text-[10px] text-gray-500 mt-3 flex items-center gap-1.5 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  {t('noCodeHint')}
                </p>
              </motion.div>
            )}

            {errorMsg && (
              <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-3 rounded-xl mt-6 text-center border border-red-100">
                {errorMsg}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-[var(--color-brand-blue)] text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 mt-6 text-center disabled:opacity-70">
              {isLoading ? t('creatingAccount') : (role === 'patient' ? t('createAccount') : t('createCaregiverAccount'))}
              {!isLoading && role === 'caregiver' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </form>


          <div className="mt-10 text-center text-sm text-gray-500 font-medium">
            {t('alreadyHaveAccount')} <Link href="/login" className="text-blue-500 font-bold hover:underline">{t('signInLink')}</Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
