'use client';
import { motion } from 'framer-motion';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export interface Probe {
  title: string;
  question: string;
  options?: string[];
  category?: string;
}

interface ProbeCardsProps {
  probes: Probe[];
  onAnswersSubmitted: (answers: string[], probeAnswers: { title: string; question: string; answer: string }[]) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  label?: string;
}

const COLORS = [
  { bg: 'bg-red-50', text: 'text-red-500' },
  { bg: 'bg-indigo-50', text: 'text-indigo-500' },
  { bg: 'bg-amber-50', text: 'text-amber-500' },
  { bg: 'bg-purple-50', text: 'text-purple-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-500' },
];

export default function ProbeCards({ probes, onAnswersSubmitted, isLoading, emptyMessage, label }: ProbeCardsProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => { updateArrows(); }, [probes.length, updateArrows]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  const toggle = (probe: string) => {
    setSelected(prev => {
      if (prev.includes(probe)) return prev.filter(p => p !== probe);
      const prefix = probe.split(': ')[0] + ': ';
      return [...prev.filter(p => !p.startsWith(prefix)), probe];
    });
  };

  const allAnswered = probes.length > 0 && probes.every(p => selected.some(s => s.startsWith(p.title + ': ')));

  const handleSubmit = () => {
    if (selected.length === 0) return;
    const answers = selected.map(s => {
      const [title, answer] = s.split(': ');
      const matched = probes.find(p => p.title === title);
      return { title: title || 'General', question: matched?.question || title, answer: answer || s };
    });
    onAnswersSubmitted(selected, answers);
    setSelected([]);
  };

  if (probes.length === 0 && !isLoading) {
    if (!emptyMessage) return null;
    return (
      <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-[2rem] p-7 flex items-center justify-center text-gray-400 text-sm font-bold text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
          {label || 'Health Probes'}
          {isLoading && <span className="text-sm text-gray-400 font-medium animate-pulse">Loading...</span>}
        </h3>
        {selected.length > 0 && (
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 bg-[var(--color-brand-dark)] hover:bg-[#1a2542] text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md active:scale-95"
          >
            {allAnswered ? (
              <>
                Submit
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Submit ({selected.length}/{probes.length})
              </>
            )}
          </button>
        )}
      </div>

      <div className="relative">
        {probes.length >= 3 && canScrollLeft && (
          <button onClick={() => scroll('left')} className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all active:scale-90" aria-label="Scroll left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <motion.div ref={scrollRef} onScroll={updateArrows} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar scroll-smooth">
          {probes.map((probe, idx) => {
            const color = COLORS[idx % COLORS.length];
            return (
              <div key={`probe-${idx}`} className="flex-shrink-0 w-80 bg-white border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[2rem] p-7 snap-start flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-6 h-6 ${color.bg} ${color.text} flex items-center justify-center rounded-full`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{probe.title}</span>
                  </div>
                  <p className="text-[var(--color-brand-dark)] font-bold text-lg leading-snug tracking-tight mb-8">{probe.question}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {probe.options?.map((val) => {
                    const isSelected = selected.includes(`${probe.title}: ${val}`);
                    return (
                      <button key={val} onClick={() => toggle(`${probe.title}: ${val}`)} className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${isSelected ? `${color.bg} ${color.text} shadow-sm ring-1 ring-current/20` : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
        {probes.length >= 3 && canScrollRight && (
          <button onClick={() => scroll('right')} className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all active:scale-90" aria-label="Scroll right">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
