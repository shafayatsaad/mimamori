'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!token) {
      return (
        <div className="text-center space-y-6">
          <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-4 rounded-xl border border-red-100">
            Invalid reset link. No token was provided.
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      );
    }

    if (success) {
      return (
        <div className="text-center space-y-6">
          <div className="bg-green-50 text-green-700 text-[13px] font-bold px-4 py-4 rounded-xl border border-green-100">
            Password has been reset successfully.
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Login
          </Link>
        </div>
      );
    }

    return (
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-red-600 text-[13px] font-bold px-4 py-3 rounded-xl text-center border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[13px] font-bold text-gray-900 mb-2">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              className={`w-full pl-4 pr-12 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400 ${!showPassword ? 'font-serif tracking-widest' : ''}`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-gray-900 mb-2">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              className={`w-full pl-4 pr-12 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400 ${!showConfirmPassword ? 'font-serif tracking-widest' : ''}`}
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {showConfirmPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[var(--color-brand-blue)] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 mt-2 disabled:opacity-70"
        >
          {isLoading ? 'Resetting...' : 'Reset Password'}
          {!isLoading && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          )}
        </button>
      </form>
    );
  };

  return renderContent();
}

export default function ResetPasswordPage() {
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center gap-3 mb-10"
        >
          <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={52} height={52} className="object-contain" />
          <span className="text-2xl font-bold text-gray-900 tracking-tight">Mimamori</span>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="w-full bg-white rounded-3xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Set New Password</h1>
            <p className="text-gray-500 text-sm">Enter your new password below</p>
          </div>

          <Suspense fallback={<div className="text-center text-gray-400 text-sm">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </motion.div>

        {/* Footer text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="text-sm text-gray-500 font-medium">
            Remember your password?{' '}
            <Link href="/login" className="text-blue-500 font-bold hover:underline">Sign In</Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
