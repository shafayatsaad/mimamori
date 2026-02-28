'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { classifyDocument, DEFAULT_CATEGORY_RULES, getDisplayCategory } from '@/lib/document-categorization';
import { detectCriticalKeywords } from '@/lib/critical-alerts';
import ProbeCards from '@/components/ProbeCards';

const DOCUMENT_CATEGORIES = ['Lab Result', 'Prescription', 'Doctor Note', 'Insurance', 'Imaging', 'Uncategorized', 'Other'];

interface PendingUpload {
  name: string;
  size: string;
  fileUrl: string;
  suggestedCategory: string;
  selectedCategory: string;
  confidence: number;
  showLowConfidence: boolean;
}

export default function DocumentVaultPage() {
  const { documents, addDocument, removeDocument, updateDocument, patientProfile, fetchAlerts, logs, addLog } = useAppContext();
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [docSortOrder, setDocSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [docProbes, setDocProbes] = useState<any[]>([]);
  const [isGeneratingDocProbes, setIsGeneratingDocProbes] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useTranslations('documents');

  // Pagination for document list (Bug 1.17)
  const DOC_PAGE_SIZE = 10;
  const [docPage, setDocPage] = useState(1);

  const hasCriticalFinding = (doc: typeof documents[number]) => {
    if (!doc.analysis) return false;
    if (doc.analysis.criticalFinding) return true;
    const textToCheck = [doc.analysis.summary, doc.analysis.precautions].filter(Boolean).join(' ');
    return detectCriticalKeywords(textToCheck);
  };

  const hasOcrFailure = (doc: typeof documents[number]) => {
    return doc.analysis?.ocrFailed === true;
  };

  const getUnverifiedEntities = (doc: typeof documents[number]) => {
    if (!doc.analysis) return [];
    const biomarkers = (doc.analysis.biomarkers || []).filter((b: any) => b.verified === false || b.status === 'Unverified');
    const medications = (doc.analysis.medications || []).filter((m: any) => m.verified === false || m.status === 'Unverified');
    return [...biomarkers, ...medications];
  };

  const handleDocumentCategoryChange = (docId: string, newCategory: string) => {
    updateDocument(docId, { type: newCategory });
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || doc.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || doc.type === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    // Invalid dates (NaN) sort to end (oldest)
    const safeA = Number.isNaN(timeA) ? 0 : timeA;
    const safeB = Number.isNaN(timeB) ? 0 : timeB;
    return docSortOrder === 'newest' ? safeB - safeA : safeA - safeB;
  });

  const totalDocPages = Math.max(1, Math.ceil(filteredDocuments.length / DOC_PAGE_SIZE));
  // Reset to page 1 when filters change
  useEffect(() => {
    setDocPage(1);
  }, [searchTerm, selectedCategory, docSortOrder]);
  const paginatedDocuments = filteredDocuments.slice((docPage - 1) * DOC_PAGE_SIZE, docPage * DOC_PAGE_SIZE);

  const totalMB = documents.reduce((acc, doc) => acc + parseFloat(doc.size || '0'), 0);
  const usagePercentage = Math.min(100, (totalMB / (100 * 1024)) * 100);

  const simulateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    
    // Simulate network delay
    await new Promise(res => setTimeout(res, 1500));

    const newPending: PendingUpload[] = [];

    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const docType = classifyDocument(file.type, ext, DEFAULT_CATEGORY_RULES, 'Lab Result', file.name);

      // Compute confidence-based display category
      // For non-image files, rule-based classification has confidence 1.0
      const classificationResult = { category: docType, confidence: 1.0 };
      const displayResult = getDisplayCategory(classificationResult);

      let fileUrl = '';
      try {
        // Server-side proxy upload (no CORS needed)
        const formData = new FormData();
        formData.append('file', file);
        if (patientProfile?.email) {
           formData.append('userId', patientProfile.email);
        }

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok || !uploadData.fileUrl) {
           throw new Error(uploadData.error || 'Upload failed');
        }
        
        fileUrl = uploadData.fileUrl;
      } catch (err) {
        console.error("S3 Upload Error:", err);
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(`Failed to upload ${file.name}: ${message}`);
        setTimeout(() => setUploadError(null), 6000);
        continue;
      }

      newPending.push({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        fileUrl,
        suggestedCategory: docType,
        selectedCategory: displayResult.displayCategory,
        confidence: classificationResult.confidence,
        showLowConfidence: displayResult.showLowConfidence,
      });
    }

    setIsUploading(false);

    if (newPending.length > 0) {
      setPendingUploads(prev => [...prev, ...newPending]);
    }
  };

  const handleConfirmUpload = (index: number) => {
    const pending = pendingUploads[index];
    addDocument({
      name: pending.name,
      type: pending.selectedCategory,
      size: pending.size,
      fileUrl: pending.fileUrl,
    });
    setPendingUploads(prev => prev.filter((_, i) => i !== index));
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    // Refresh alerts to pick up any document analysis alerts
    fetchAlerts();
    // Generate probes based on the uploaded document
    fetchDocumentProbes(pending.name, pending.selectedCategory);
  };

  const handleConfirmAll = () => {
    const names = pendingUploads.map(p => p.name);
    const categories = pendingUploads.map(p => p.selectedCategory);
    for (const pending of pendingUploads) {
      addDocument({
        name: pending.name,
        type: pending.selectedCategory,
        size: pending.size,
        fileUrl: pending.fileUrl,
      });
    }
    setPendingUploads([]);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    // Refresh alerts to pick up any document analysis alerts
    fetchAlerts();
    // Generate probes based on uploaded documents
    if (names.length > 0) {
      fetchDocumentProbes(names.join(', '), categories.join(', '));
    }
  };

  const fetchDocumentProbes = async (docName: string, docType: string) => {
    setIsGeneratingDocProbes(true);
    try {
      const extraContext = `The patient just uploaded a document: "${docName}" (type: ${docType}). ` +
        'Based on this document type and the patient\'s history, generate follow-up questions if clinically relevant.';
      const analyzedDocs = documents.filter(d => d.analysis).map(d => ({ name: d.name, analysis: d.analysis }));
      const res = await fetch('/api/medical-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(0, 5),
          documents: analyzedDocs.slice(0, 5),
          promptType: 'generate-followup-probes',
          extraContext
        })
      });
      if (res.ok) {
        const data = await res.json();
        let parsed: any[] = [];
        try { parsed = JSON.parse(data.insight); } catch { /* empty */ }
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocProbes(parsed);
        }
      }
    } catch (err) {
      console.error('Document probe generation failed:', err);
    } finally {
      setIsGeneratingDocProbes(false);
    }
  };

  const handleDocProbeAnswers = (answers: string[], probeAnswers: { title: string; question: string; answer: string }[]) => {
    addLog(`Answered ${answers.length} probes after document upload.`, answers, [], probeAnswers);
    setDocProbes([]);
  };

  const handleCategoryChange = (index: number, category: string) => {
    setPendingUploads(prev => prev.map((p, i) => i === index ? { ...p, selectedCategory: category } : p));
  };

  const handleDismissUpload = (index: number) => {
    setPendingUploads(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-6xl mx-auto relative min-w-0">
      <input type="file" ref={fileInputRef} className="hidden" onChange={simulateUpload} multiple accept="image/*,.pdf,.txt,.csv,.json,.xml,.html,.md,.rtf,.docx,.xls,.xlsx,.tiff,.tif,.dicom,.dcm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/tiff,application/dicom" />
      
      {showSuccessToast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--color-brand-green)] text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm z-50 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {t('uploadSuccess')}
        </motion.div>
      )}

      {uploadError && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm z-50 flex items-center gap-2 max-w-md text-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {uploadError}
        </motion.div>
      )}

      {/* Pending Upload Category Confirmation */}
      <AnimatePresence>
        {pendingUploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Confirm document {pendingUploads.length === 1 ? 'category' : 'categories'}
              </h3>
              {pendingUploads.length > 1 && (
                <button
                  onClick={handleConfirmAll}
                  className="text-[#10b981] font-bold text-xs hover:text-[#059669] transition-colors"
                >
                  Confirm All
                </button>
              )}
            </div>
            {pendingUploads.map((pending, index) => (
              <motion.div
                key={`${pending.name}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card rounded-2xl p-4 flex flex-col gap-3 border border-amber-200/50 bg-amber-50/30"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{pending.name}</p>
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 flex-wrap">
                        AI suggested: <span className="text-amber-600 font-bold">{pending.suggestedCategory}</span>
                        <span className="text-gray-400 font-medium">({Math.round(pending.confidence * 100)}%)</span>
                        {pending.showLowConfidence && (
                          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Low confidence</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={pending.selectedCategory}
                      onChange={(e) => handleCategoryChange(index, e.target.value)}
                      className="text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent cursor-pointer"
                      aria-label={`Category for ${pending.name}`}
                      ref={(el) => {
                        // Auto-expand dropdown when low confidence
                        if (el && pending.showLowConfidence) {
                          el.size = DOCUMENT_CATEGORIES.length;
                        }
                      }}
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleConfirmUpload(index)}
                      className="bg-[#10b981] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#059669] transition-colors flex items-center gap-1.5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Confirm
                    </button>
                    <button
                      onClick={() => handleDismissUpload(index)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"
                      aria-label={`Dismiss ${pending.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Probes — shown after uploading and confirming a document */}
      {(docProbes.length > 0 || isGeneratingDocProbes) && (
        <div className="mb-8">
          <ProbeCards
            probes={docProbes}
            onAnswersSubmitted={handleDocProbeAnswers}
            isLoading={isGeneratingDocProbes}
            label="Questions About Your Document"
          />
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start mb-8 gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            Document Vault
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[#128C7E] font-medium mt-2 text-[15px] max-w-xl leading-relaxed"
          >
            Securely store, organize, and analyze your medical history with AI assistance.
          </motion.p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-[var(--color-brand-dark)] text-white px-5 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#1a2542] transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Record
        </button>
      </div>

      {/* Search & Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-8"
      >
        <div className="flex-1 glass-card rounded-full px-6 py-4 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#258bf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder={t('searchPlaceholder')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium placeholder:text-[#3ba53b]/60 text-[#128C7E]" 
          />
        </div>
        <button
          onClick={() => setDocSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-5 py-4 rounded-full glass-card text-sm font-bold text-gray-600 hover:bg-white/40 transition-colors flex-shrink-0"
          aria-label={`Sort by ${docSortOrder === 'newest' ? 'oldest first' : 'newest first'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"></path><path d="M11 9h7"></path><path d="M11 13h4"></path><path d="M3 17l3 3 3-3"></path><path d="M6 18V4"></path></svg>
          {docSortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:overflow-visible no-scrollbar">
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column (Utilities) */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6">
          
          {/* Quick Upload */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`glass-card border-none rounded-[2rem] p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
              isUploading ? 'bg-white/40 cursor-not-allowed' : 'hover:bg-white/80'
            }`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 ${isUploading ? 'bg-gray-200 text-gray-400' : 'bg-[#d1fae5] text-[#10b981]'}`}>
              {isUploading ? (
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-[15px] mb-1">{isUploading ? t('uploading') : t('quickUpload')}</h3>
            <p className="text-[#3ba53b] text-xs font-medium mb-6">{isUploading ? t('analyzingDocument') : t('dragAndDrop')}</p>
            <button className="bg-[#eefcf2] text-[#10b981] font-bold text-[11px] tracking-wider uppercase px-6 py-2.5 rounded-full hover:bg-[#d1fae5] transition-colors disabled:opacity-50" disabled={isUploading}>
              {isUploading ? 'Please wait' : 'Select File'}
            </button>
          </motion.div>

          {/* Vault Usage */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="glass-card rounded-[2rem] p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-[15px]">{t('vaultUsage')}</h3>
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">{t('activePlan')}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
              <div className="bg-[#10b981] h-2 rounded-full transition-all duration-1000" style={{ width: `${usagePercentage}%` }}></div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#10b981] font-bold text-[13px]">{totalMB.toFixed(1)}MB <span className="text-gray-400 font-medium">{t('used')}</span></span>
              <span className="text-gray-900 font-bold text-[13px]">100GB <span className="text-gray-400 font-medium">{t('total')}</span></span>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-card rounded-[2rem] p-6"
          >
            <h3 className="font-bold text-gray-900 text-[15px] mb-6">{t('recentActivity')}</h3>
            {documents.length > 0 ? (
              <div className="space-y-5">
                {[...documents].sort((a, b) => {
                    const timeA = a.date ? new Date(a.date).getTime() : 0;
                    const timeB = b.date ? new Date(b.date).getTime() : 0;
                    const safeA = Number.isNaN(timeA) ? 0 : timeA;
                    const safeB = Number.isNaN(timeB) ? 0 : timeB;
                    return safeB - safeA;
                  }).slice(0, 3).map((doc, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className="w-2 h-2 bg-[#10b981] rounded-full mt-1.5 flex-shrink-0 relative z-10"></div>
                    {i !== Math.min(documents.length, 3) - 1 && <div className="absolute top-3 left-[3px] w-0.5 h-10 bg-gray-100"></div>}
                    <div className="flex-1 min-w-0 pr-2">
                       <p className="text-[13px] font-bold text-gray-900 leading-snug truncate">{t('uploaded', { name: doc.name })}</p>
                       <p className="text-[11px] font-medium text-[#3ba53b] mt-0.5">{doc.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm font-medium text-gray-500">{t('waitForActivity')}</div>
            )}
          </motion.div>

        </div>

        {/* Right Column (Main Content) */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Categories */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              <h2 className="text-lg font-bold text-gray-900">{t('categories')}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div onClick={() => setSelectedCategory('All')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'All' ? 'border-2 border-gray-400' : 'hover:border-gray-200/50'}`}>
                <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">All Records</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Prescription')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Prescription' ? 'border-2 border-green-400' : 'hover:border-green-100/50'}`}>
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 19 12a3.53 3.53 0 0 0-5-5l-8.5 8.5a3.53 3.53 0 0 0 5 5z"></path></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{t('prescriptions')}</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Prescription').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Lab Result')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Lab Result' ? 'border-2 border-blue-400' : 'hover:border-blue-100/50'}`}>
                <div className="w-12 h-12 bg-[#d1fae5] text-[#10b981] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15 10a5 5 0 0 0-10 0c0 2 1 4 3 5 0 2 .5 3 2 3h4c1.5 0 2-1 2-3 2-1 3-3 3-5"></path></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{t('labResults')}</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Lab Result').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Doctor Note')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Doctor Note' ? 'border-2 border-orange-400' : 'hover:border-orange-100/50'}`}>
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><rect x="8" y="6" width="4" height="4"></rect><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{t('doctorNotes')}</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Doctor Note').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Insurance')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Insurance' ? 'border-2 border-emerald-400' : 'hover:border-emerald-100/50'}`}>
                <div className="w-12 h-12 bg-emerald-50 text-[#128C7E] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{t('insurance')}</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Insurance').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Imaging')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Imaging' ? 'border-2 border-purple-400' : 'hover:border-purple-100/50'}`}>
                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">Imaging</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Imaging').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Uncategorized')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Uncategorized' ? 'border-2 border-gray-400' : 'hover:border-gray-200/50'}`}>
                <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">Uncategorized</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => d.type === 'Uncategorized').length })}</p>
              </div>

              <div onClick={() => setSelectedCategory('Other')} className={`glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${selectedCategory === 'Other' ? 'border-2 border-teal-400' : 'hover:border-teal-100/50'}`}>
                <div className="w-12 h-12 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">Other</h4>
                <p className="text-[11px] font-bold text-[#3ba53b]">{t('files', { count: documents.filter(d => !['Prescription','Lab Result','Doctor Note','Insurance','Imaging','Uncategorized'].includes(d.type)).length })}</p>
              </div>

            </div>
          </div>

          {/* All Files Table */}
          <div className="glass-card rounded-[2rem] overflow-hidden">
            <div className="p-6 flex justify-between items-center border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">{t('allFiles')}</h2>
            </div>
            
            <div className="px-6 pb-6 overflow-x-auto">
              <table className="w-full text-left min-w-[600px] table-fixed">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 text-[10px] font-bold text-[#3ba53b] uppercase tracking-widest w-[40%]">{t('name')}</th>
                    <th className="py-4 text-[10px] font-bold text-[#3ba53b] uppercase tracking-widest w-[20%]">{t('category')}</th>
                    <th className="py-4 text-[10px] font-bold text-[#3ba53b] uppercase tracking-widest text-right whitespace-nowrap pl-6 w-[20%]">{t('dateAdded')}</th>
                    <th className="py-4 text-[10px] font-bold text-[#3ba53b] uppercase tracking-widest text-right whitespace-nowrap pl-6 w-[20%]">{t('size')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                          <p className="text-[14px] font-bold text-gray-900 mb-1">{t('noDocumentsTable')}</p>
                          <p className="text-sm font-medium text-gray-400">{t('uploadOrAdjustFilters')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedDocuments.map(doc => (
                    <tr key={doc.id} onClick={() => router.push(`/dashboard/documents/report?id=${doc.id}`)} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                          {doc.type === 'Photo' ? (
                             <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></>
                          ) : (
                             <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></>
                          )}
                        </svg>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-gray-900 truncate">{doc.name}</span>
                          {hasCriticalFinding(doc) && (
                            <span className="text-red-600 text-[11px] font-bold flex items-start gap-1.5 mt-1">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                              Critical finding
                            </span>
                          )}
                          {hasOcrFailure(doc) && (
                            <span className="text-amber-600 text-[10px] font-bold flex items-center gap-1 mt-0.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              Text extraction was limited — analysis may be incomplete
                            </span>
                          )}
                          {getUnverifiedEntities(doc).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {getUnverifiedEntities(doc).slice(0, 2).map((entity: any, i: number) => (
                                <span key={i} className="bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0 rounded text-[9px] font-bold">
                                  {entity.name} — Unverified
                                </span>
                              ))}
                              {getUnverifiedEntities(doc).length > 2 && (
                                <span className="text-amber-600 text-[9px] font-bold">+{getUnverifiedEntities(doc).length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={doc.type}
                            onChange={(e) => { e.stopPropagation(); handleDocumentCategoryChange(doc.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border-none outline-none cursor-pointer ${
                              doc.type === 'Insurance' ? 'bg-purple-50 text-purple-600' :
                              doc.type === 'Prescription' ? 'bg-green-50 text-green-600' :
                              doc.type === 'Doctor Note' ? 'bg-red-50 text-red-600' :
                              doc.type === 'Uncategorized' ? 'bg-gray-100 text-gray-600' :
                              'bg-blue-50 text-blue-600'
                            }`}
                            aria-label={`Change category for ${doc.name}`}
                          >
                            {DOCUMENT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-4 text-[13px] font-medium text-[#128C7E] text-right whitespace-nowrap pl-6">{doc.date}</td>
                      <td className="py-4 text-[13px] font-medium text-[#128C7E] text-right whitespace-nowrap pl-6">
                         <div className="flex items-center justify-end gap-3">
                           <span>{doc.size}</span>
                           <button onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-20">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {totalDocPages > 1 && (
              <div className="flex items-center justify-center gap-2 px-6 pb-6">
                <button
                  onClick={() => setDocPage(p => Math.max(1, p - 1))}
                  disabled={docPage === 1}
                  className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                  aria-label="Previous page"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalDocPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setDocPage(page)}
                    className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                      page === docPage
                        ? 'bg-[var(--color-brand-dark)] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label={`Page ${page}`}
                    aria-current={page === docPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setDocPage(p => Math.min(totalDocPages, p + 1))}
                  disabled={docPage === totalDocPages}
                  className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
