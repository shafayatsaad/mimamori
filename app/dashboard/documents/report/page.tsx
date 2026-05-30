'use client';
import { Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { useSearchParams } from 'next/navigation';

function LabReportAnalysisContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { documents, patientProfile, updateDocument, addLog } = useAppContext();
  const doc = documents.find(d => d.id === id) || { id: 'fallback', name: 'Comprehensive Metabolic Panel', date: 'Oct 24, 2023', type: 'Lab Result', size: '1.2 MB', fileUrl: '', status: 'Analyzed' } as any;
  
  const isSupabaseStorage = doc.fileUrl && (doc.fileUrl.startsWith('s3://') || doc.fileUrl.startsWith('supabase://'));
  const displayUrl = isSupabaseStorage ? `/api/download?url=${encodeURIComponent(doc.fileUrl)}` : doc.fileUrl;

  const fileName = doc.name.toLowerCase();
  const isPdf = fileName.endsWith('.pdf');
  const isDocx = fileName.endsWith('.doc') || fileName.endsWith('.docx');
  const isImage = !isPdf && !isDocx && (doc.type === 'Prescription' || doc.type === 'Photo' || fileName.match(/\.(png|jpe?g|webp|gif)$/) || !!(doc.fileUrl && (doc.fileUrl.startsWith('blob:') || doc.fileUrl.startsWith('data:'))));

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [extractedName, setExtractedName] = useState<string | null>(null);
  const [actualType, setActualType] = useState<string | null>(null);
  const [precautions, setPrecautions] = useState<string | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [rejectedMeds, setRejectedMeds] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    async function fetchAnalysis() {
      // 1. If we have a target document ID in URL but it hasn't loaded in state yet, wait.
      if (doc.id === 'fallback' && id) {
        return;
      }

      // 2. Only use existing analysis if it has a summary and no error.
      if (doc.analysis && !doc.analysis.error && doc.analysis.summary) {
        setAiSummary(doc.analysis.summary);
        setBiomarkers(doc.analysis.biomarkers || []);
        setExtractedName(doc.analysis.extractedName || 'Unknown');
        setActualType(doc.analysis.actualType || doc.type);
        setPrecautions(doc.analysis.precautions || null);
        setMedications(doc.analysis.medications || []);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/analyze-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docName: doc.name, fileUrl: doc.fileUrl })
        });
        const data = await res.json();
        
        if (data.error) {
          setAiSummary(`Analysis failed: ${data.error}`);
          updateDocument(doc.id, { analysis: data });
          setIsAnalyzing(false);
          return;
        }
        
        setAiSummary(data.summary);
        setBiomarkers(data.biomarkers || []);
        setExtractedName(data.extractedName || 'Unknown');
        setActualType(data.actualType || doc.type);
        setPrecautions(data.precautions || null);
        setMedications(data.medications || []);

        updateDocument(doc.id, { analysis: data });

        if (data.medications && data.medications.length > 0) {
           // We no longer auto-push logs here. 
           // We wait for the user to verify and click "Save Verification" via handleSaveCorrections.
        }
      } catch (err) {
        console.error('Failed to analyze document', err);
        setAiSummary('Analysis failed to load due to a network error.');
      } finally {
        setIsAnalyzing(false);
      }
    }
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const handleSaveCorrections = () => {
     const approvedMeds = medications.filter((_, idx) => !rejectedMeds.includes(idx));
     setMedications(approvedMeds);
     setRejectedMeds([]);
     
     // Overwrite the analysis data with the corrected array
     updateDocument(doc.id, { 
        analysis: {
           summary: aiSummary,
           biomarkers,
           extractedName,
           actualType,
           precautions,
           medications: approvedMeds
        } 
     });

     // Push ONLY the approved logs
     approvedMeds.forEach((med: any) => {
        addLog(`AI detected prescription [VERIFIED]: dose of ${med.name} ${med.dosage} ${med.frequency}`, []);
     });
     
     alert('Clinical data verified and saved to your dashboard.');
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/documents" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3 truncate max-w-[600px]">
            {doc.name}
            <span className="bg-[#d1fae5] text-[#10b981] px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider hidden sm:inline-block flex-shrink-0">AI Analyzed</span>
          </h1>
          <p className="text-gray-500 font-medium mt-1 text-sm">Uploaded on {doc.date} • Mimamori Vault</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column (Document Preview) */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
               {isImage && displayUrl ? (
                 <img src={displayUrl} alt={doc.name} className="w-full h-full object-cover" />
               ) : isPdf && displayUrl ? (
                 <iframe src={displayUrl} className="w-full h-full border-0" title={doc.name} />
               ) : isDocx ? (
                 <div className="flex flex-col items-center gap-3">
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Word Document</span>
                 </div>
               ) : isImage ? (
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
               ) : (
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
               )}
             </div>
             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
               <button 
                 onClick={() => displayUrl && window.open(displayUrl, '_blank')}
                 className="bg-white text-gray-900 px-6 py-2.5 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform hover:bg-gray-50 hover:scale-105 active:scale-95"
               >
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                 View Original File
               </button>
             </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-900 text-[15px] mb-4">Patient Info extracted</h3>
             <ul className="space-y-3 text-sm">
               <li className="flex justify-between items-center"><span className="text-gray-500 font-medium">Name</span><span className="font-bold text-gray-900">{isAnalyzing ? 'Extracting...' : (extractedName && extractedName !== 'Unknown' ? extractedName : (patientProfile.name || 'John Doe'))}</span></li>
               <li className="flex justify-between items-center"><span className="text-gray-500 font-medium">Type</span><span className="font-bold text-gray-900">{isAnalyzing ? 'Extracting...' : (actualType || doc.type)}</span></li>
               <li className="flex justify-between items-center"><span className="text-gray-500 font-medium">Size</span><span className="font-bold text-gray-900">{doc.size || '0.0MB'}</span></li>
             </ul>
          </motion.div>
        </div>

        {/* Right Column (Analysis) */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-gradient-to-br from-[#effcf4] to-[#f0fdf4] border border-[#10b981]/20 rounded-3xl p-8 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#a7f3d0]/40 rounded-full blur-[60px] animate-pulse -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#34d399]/20 rounded-full blur-[50px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>
            <h2 className="text-[#10b981] font-bold text-xl flex items-center gap-2 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              AI Summary & plain English translation
            </h2>
            <p className="text-[#1e4a19] text-[15px] leading-relaxed font-medium">
              {isAnalyzing ? (
                 <span className="flex items-center gap-2 animate-pulse"><span className="w-4 h-4 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin inline-block"></span> Fetching AI Analysis...</span>
              ) : (
                 aiSummary || "No summary available."
              )}
            </p>

            {precautions && precautions !== 'No precautions detailed.' && precautions !== 'N/A' && (
              <div className="mt-6 pt-6 border-t border-[#10b981]/20">
                <h3 className="text-[#10b981] font-bold text-[15px] mb-2 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  Precautions & Follow-up
                </h3>
                <p className="text-[#1e4a19] text-[14px] font-medium leading-relaxed">{precautions}</p>
              </div>
            )}
            
            {medications && medications.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#10b981]/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#10b981] font-bold text-[15px] flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 19 12a3.53 3.53 0 0 0-5-5l-8.5 8.5a3.53 3.53 0 0 0 5 5z"></path><line x1="10.5" y1="13.5" x2="15.5" y2="8.5"></line><path d="M14 2h6v6"></path><path d="M12.5 10.5 20 3"></path></svg>
                    Prescribed Medications
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-[#10b981] px-2 py-1 bg-[#10b981]/10 rounded-full">AI Extracted • Review Required</span>
                </div>
                <p className="text-xs text-[#1e4a19]/70 font-medium mb-4">Mimamori extracted these medications from your document. Please uncheck any items that are incorrect or should not be logged to your daily dashboard.</p>
                <div className="flex flex-col gap-3">
                  {medications.map((m: any, idx: number) => {
                    const isRejected = rejectedMeds.includes(idx);
                    return (
                      <label key={idx} className={`flex items-start gap-4 p-3 rounded-2xl border transition-colors cursor-pointer ${isRejected ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-[#10b981]/30 hover:border-[#10b981] shadow-sm'}`}>
                         <input 
                           type="checkbox" 
                           checked={!isRejected}
                           onChange={() => {
                              setRejectedMeds(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
                           }}
                           className="mt-1 w-5 h-5 rounded border-gray-300 text-[#10b981] focus:ring-[#10b981]" 
                         />
                         <div className="flex-1">
                           <p className={`font-bold ${isRejected ? 'text-gray-500 line-through' : 'text-[#059669]'}`}>{m.name}</p>
                           <p className={`text-xs mt-0.5 font-medium ${isRejected ? 'text-gray-400' : 'text-[#1e4a19]/80'}`}>Dosage: {m.dosage} • Frequency: {m.frequency}</p>
                         </div>
                      </label>
                    );
                  })}
                </div>
                {rejectedMeds.length > 0 && (
                   <div className="mt-4 flex justify-end">
                      <button 
                         onClick={handleSaveCorrections}
                         className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                      >
                         Save Verification
                      </button>
                   </div>
                )}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden">
             <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
               <h3 className="font-bold text-gray-900 text-[15px]">Key Biomarkers</h3>
             </div>
             <div>
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b border-gray-100">
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white">Test</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white">Result</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white">Reference Range</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white text-right">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {isAnalyzing ? (
                     <tr><td colSpan={4} className="py-5 px-6 text-center text-gray-500 text-sm animate-pulse">Extracting biomarkers...</td></tr>
                   ) : biomarkers.length > 0 ? biomarkers.map((bm, index) => (
                     <tr key={index} className="border-b border-gray-50 group hover:bg-gray-50/50">
                       <td className="py-5 px-6 font-bold text-gray-900 text-sm">{bm.name}</td>
                       <td className={`py-5 px-6 font-black text-[15px] whitespace-nowrap ${bm.status === 'Normal' ? 'text-green-600' : bm.status === 'High' ? 'text-orange-500' : bm.status === 'Low' ? 'text-blue-500' : 'text-gray-900'}`}>
                         {bm.result}{bm.unit ? <> <span className={`text-xs font-bold ${bm.status === 'Normal' ? 'text-green-500' : bm.status === 'High' ? 'text-orange-400' : bm.status === 'Low' ? 'text-blue-400' : 'text-gray-400'}`}>{bm.unit}</span></> : null}
                       </td>
                       <td className="py-5 px-6 font-medium text-gray-500 text-[13px]">{bm.range}</td>
                       <td className="py-5 px-6 text-right">
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${bm.status === 'Normal' ? 'bg-green-50 text-green-600' : bm.status === 'High' ? 'bg-orange-50 text-orange-600' : bm.status === 'Low' ? 'bg-blue-50 text-blue-600' : bm.status === 'Unverified' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                            {bm.status === 'Status not determined' ? 'N/A' : bm.status}
                          </span>
                       </td>
                     </tr>
                   )) : (
                     <tr><td colSpan={4} className="py-5 px-6 text-center text-gray-500 text-sm font-medium">No specific biomarkers extracted for this document type.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}

export default function LabReportAnalysisPage() {
  return (
    <Suspense fallback={<div className="w-full h-full pt-2 max-w-4xl mx-auto text-gray-500">Loading report...</div>}>
      <LabReportAnalysisContent />
    </Suspense>
  );
}
