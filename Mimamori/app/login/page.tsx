'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAppContext();
  const t = useTranslations('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Forcefully clear all local storage to guarantee a clean slate for new logins
    localStorage.clear();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(t('enterBoth'));
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        await login(data.user);
        router.push(data.user.role === 'caregiver' ? '/dashboard/patients' : '/dashboard');
      } else if (res.status === 503) {
        setErrorMsg(t('serviceUnavailable'));
      } else {
        setErrorMsg(data.error || t('loginFailed'));
      }
    } catch (err) {
      setErrorMsg(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
      
      {/* Subtle Background Rings */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute w-[600px] h-[600px] border border-gray-100/80 rounded-full" />
        <div className="absolute w-[1000px] h-[1000px] border border-gray-100/50 rounded-full" />
        <div className="absolute w-[1400px] h-[1400px] border border-gray-50/80 rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center">
        
        {/* Logo Head */}
        <Link href="/">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center gap-3 mb-10"
        >
          <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={52} height={52} className="object-contain" />
          <span className="text-2xl font-bold text-gray-900 tracking-tight">Mimamori</span>
        </motion.div>
        </Link>

        {/* Auth Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="w-full bg-white rounded-3xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{t('title')}</h1>
            <p className="text-gray-500 text-sm">{t('subtitle')}</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {errorMsg && (
              <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-3 rounded-xl text-center border border-red-100">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-[13px] font-bold text-gray-900 mb-2">{t('emailLabel')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-bold text-gray-900">{t('passwordLabel')}</label>
                <Link href="/forgot-password" className="text-[12px] font-bold text-blue-500 hover:text-blue-600 transition-colors">{t('forgotPassword')}</Link>
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} className={`w-full pl-4 pr-12 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400 ${!showPassword ? 'font-serif tracking-widest' : ''}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-[var(--color-brand-blue)] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 mt-2 block text-center disabled:opacity-70">
              {isLoading ? t('signingIn') : t('submitButton')}
              {!isLoading && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </form>
        </motion.div>

        {/* Footer text */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="text-sm text-gray-500 font-medium mb-6">
            {t('noAccount')} <Link href="/signup" className="text-blue-500 font-bold hover:underline">{t('signupLink')}</Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
