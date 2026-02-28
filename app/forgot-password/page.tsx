'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.status === 503) {
        // Infrastructure unavailable (DynamoDB/SES not configured)
        setErrorMessage(
          'Our email service is temporarily unavailable. Please try again later or contact support.'
        );
        return;
      }

      if (!res.ok) {
        setErrorMessage(
          'Something went wrong. Please try again later.'
        );
        return;
      }

      // Success — show the same message regardless of whether email exists (enumeration prevention)
      setSubmitted(true);
    } catch {
      // Network error or fetch failure
      setErrorMessage(
        'Unable to connect to the server. Please check your connection and try again.'
      );
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
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Reset Password</h1>
            <p className="text-gray-500 text-sm">Enter your email and we&apos;ll send you a reset link</p>
          </div>

          {submitted ? (
            <div className="text-center space-y-6">
              <div className="bg-green-50 text-green-700 text-[13px] font-bold px-4 py-4 rounded-xl border border-green-100">
                If an account with that email exists, we&apos;ve sent a password reset link.
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="bg-red-50 text-red-700 text-[13px] font-bold px-4 py-4 rounded-xl border border-red-100">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-[13px] font-bold text-gray-900 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[var(--color-brand-blue)] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 mt-2 disabled:opacity-70"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
                {!isLoading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                )}
              </button>
            </form>
          )}
        </motion.div>

        {/* Footer text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          {!submitted && (
            <div className="text-sm text-gray-500 font-medium">
              Remember your password?{' '}
              <Link href="/login" className="text-blue-500 font-bold hover:underline">Sign In</Link>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}


