'use client';
import { useState } from 'react';
import { CTAProps } from '../content/types';
import DemoContactModal from './DemoContactModal';

export default function CTASection({ 
  heading, 
  buttonText, 
  buttonLink,
  description 
}: CTAProps) {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <section className="py-24 px-4 bg-brand-dark text-white text-center">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-bold mb-8 leading-tight">
          {heading}
        </h2>
        {description && (
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
            {description}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href={buttonLink}
            className="bg-brand text-white px-8 py-4 rounded-xl font-bold hover:bg-brand/90 transition-all"
          >
            {buttonText}
          </a>
          <button
            onClick={() => setIsDemoOpen(true)}
            className="bg-white/10 text-white px-8 py-4 rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all"
          >
            Book a Demo
          </button>
        </div>
      </div>
      <DemoContactModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </section>
  );
}
