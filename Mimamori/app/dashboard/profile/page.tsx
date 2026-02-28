'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { useAppContext, CaregiverPermission } from '@/context/AppContext';

export default function ProfilePage() {
  const { caregivers, updateCaregiver, patientProfile, updatePatientProfile: updatePatientProfileContext } = useAppContext();
  const [weightUnit, setWeightUnit] = useState(patientProfile.targetWeightUnit || 'lbs');
  
  // Local state for profile edits
  const [profileForm, setProfileForm] = useState(patientProfile);
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = () => {
    updatePatientProfileContext(profileForm); // Call the context's update function
    showToast('Profile securely updated and syncing with your care team.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image')) {
       showToast('Please select a valid image file.');
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64Img = canvas.toDataURL('image/jpeg', 0.8);
        setProfileForm(f => ({ ...f, image: base64Img }));
        showToast("Profile photo updated! Click Save Changes above.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const togglePermission = (caregiverId: string, perm: CaregiverPermission) => {
    const caregiver = caregivers.find(c => c.id === caregiverId);
    if (!caregiver) return;
    
    const newPerms = caregiver.permissions.includes(perm)
      ? caregiver.permissions.filter(p => p !== perm)
      : [...caregiver.permissions, perm];
      
    updateCaregiver(caregiverId, { permissions: newPerms });
  };

  return (
    <div className="w-full h-full flex flex-col pt-2 max-w-6xl mx-auto relative pb-10 min-w-0">
      
      {toastMessage && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--color-brand-green)] text-white px-6 py-3 rounded-full shadow-xl font-bold text-sm z-50 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {toastMessage}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-10 gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="text-3xl font-black text-gray-900 tracking-tight"
          >
            My Profile &amp; Medical Baseline
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 font-medium mt-1 text-[15px]"
          >
            Manage your personal information and AI foundation health data.
          </motion.p>
        </div>
        <button onClick={handleSaveProfile} className="bg-[#258bf8] text-white px-6 py-3 rounded-full font-bold text-sm shadow-md flex items-center gap-2 hover:bg-[#1a7bed] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Save Changes
        </button>
      </div>

      <div className="space-y-8">
        
        {/* Personal Details Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 p-8 md:p-10"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-8">Personal Details</h2>
          
          <div className="flex flex-col md:flex-row gap-10">
            {/* Avatar Upload */}
              <div className="flex flex-col mb-4 md:mb-0 relative">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                <div 
                  className="w-24 h-24 bg-gradient-to-tr from-blue-100 to-blue-50 rounded-full border-4 border-white shadow-lg overflow-hidden flex items-center justify-center cursor-pointer relative group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profileForm.image ? (
                     <Image src={profileForm.image} alt="Profile" fill className="object-cover" />
                  ) : (
                     <span className="text-2xl font-black text-blue-500/50 block group-hover:scale-110 transition-transform duration-300 relative z-10">{profileForm.name.charAt(0) || '?'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-1 z-20 backdrop-blur-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-0.5">{profileForm.name}</h3>
                <p className="text-gray-500 font-medium text-sm mb-3">Primary Patient</p>
                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-bold text-[#258bf8] hover:text-[#1a7bed] transition-colors">Change Photo</button>
              </div>

            {/* Form Fields */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] font-bold text-gray-500 mb-2 mt-1">Full Name</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm(f => ({...f, name: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-500 mb-2 mt-1">Date of Birth</label>
                <div className="relative">
                  <input type="date" value={profileForm.dateOfBirth} onChange={e => setProfileForm(f => ({...f, dateOfBirth: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-500 mb-2 mt-1">Biological Sex</label>
                <div className="relative">
                  <select value={profileForm.gender} onChange={e => setProfileForm(f => ({...f, gender: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors appearance-none">
                    <option value="">Select...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-500 mb-2 mt-1">Blood Type</label>
                <div className="relative">
                  <select value={profileForm.bloodType} onChange={e => setProfileForm(f => ({...f, bloodType: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors appearance-none">
                    <option value="">Select...</option>
                    <option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option>
                    <option value="O+">O+</option><option value="O-">O-</option><option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Health Conditions & Vitals Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 p-8 md:p-10"
        >
          <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
            <h2 className="text-xl font-bold text-gray-900">Health Conditions &amp; Vitals</h2>
            <div className="bg-[#d1fae5] text-[#059669] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Last Updated: 2 days ago
            </div>
          </div>

          {/* Active Conditions */}
          <div className="mb-8">
            <label className="block text-[13px] font-bold text-gray-700 mb-4">Active Conditions</label>
            <div className="flex flex-wrap gap-3 items-center">
              {(profileForm.conditions || []).map(condition => (
                <div key={condition} className="bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] px-4 py-2 rounded-full text-[13px] font-medium flex items-center gap-2">
                  {condition}
                  <button onClick={() => setProfileForm(f => ({ ...f, conditions: f.conditions.filter(c => c !== condition) }))} className="text-[#60a5fa] hover:text-[#3b82f6]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
              ))}
              <div className="relative flex items-center">
                <input type="text" value={newCondition} onChange={e => setNewCondition(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter' && newCondition.trim()) {
                    setProfileForm(f => ({ ...f, conditions: [...f.conditions, newCondition.trim()] }));
                    setNewCondition('');
                  }
                }} placeholder="Add Condition" className="bg-white text-[#258bf8] border border-dashed border-[#93c5fd] hover:bg-[#eff6ff] px-5 py-2 rounded-full text-[13px] font-bold outline-none placeholder-[#93c5fd] transition-colors w-40 focus:w-48" />
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-gray-50 mb-8"></div>

          {/* Allergies */}
          <div className="mb-10">
            <label className="block text-[13px] font-bold text-gray-700 mb-4">Allergies</label>
            <div className="flex flex-wrap gap-3 items-center">
              {(profileForm.allergies || []).map(allergy => (
                <div key={allergy} className="bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] px-4 py-2 rounded-full text-[13px] font-medium flex items-center gap-2">
                  {allergy}
                  <button onClick={() => setProfileForm(f => ({ ...f, allergies: f.allergies.filter(a => a !== allergy) }))} className="text-[#fb7185] hover:text-[#e11d48]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
              ))}
              <div className="relative flex items-center">
                <input type="text" value={newAllergy} onChange={e => setNewAllergy(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter' && newAllergy.trim()) {
                    setProfileForm(f => ({ ...f, allergies: [...f.allergies, newAllergy.trim()] }));
                    setNewAllergy('');
                  }
                }} placeholder="Add Allergy" className="bg-white text-[#e11d48] border border-dashed border-[#fda4af] hover:bg-[#fff1f2] px-5 py-2 rounded-full text-[13px] font-bold outline-none placeholder-[#fda4af] transition-colors w-40 focus:w-48" />
              </div>
            </div>
          </div>

          {/* Vitals Goals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
               <div className="flex justify-between items-end mb-2">
                 <label className="block text-[13px] font-bold text-gray-700">Target Blood Pressure</label>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">mmHg</span>
               </div>
               <div className="relative">
                 <input type="text" value={profileForm.targetBP || '120/80'} onChange={e => setProfileForm(f => ({...f, targetBP: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-[15px] font-bold text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors" />
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
               </div>
            </div>
            <div>
               <div className="flex justify-between items-end mb-2">
                 <label className="block text-[13px] font-bold text-gray-700">Target Weight</label>
                 <div className="bg-gray-100 p-0.5 rounded-md flex text-[10px] font-bold">
                   <button onClick={() => { setWeightUnit('lbs'); setProfileForm(f => ({...f, targetWeightUnit: 'lbs'})); }} className={`${weightUnit === 'lbs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} px-2 py-0.5 rounded transition-colors`}>lbs</button>
                   <button onClick={() => { setWeightUnit('kg'); setProfileForm(f => ({...f, targetWeightUnit: 'kg'})); }} className={`${weightUnit === 'kg' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} px-2 py-0.5 rounded transition-colors`}>kg</button>
                 </div>
               </div>
               <div className="relative">
                 <input type="text" value={profileForm.targetWeight || (weightUnit === 'lbs' ? '145' : '65')} onChange={e => setProfileForm(f => ({...f, targetWeight: e.target.value}))} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-[15px] font-bold text-gray-900 outline-none focus:border-blue-300 focus:bg-white transition-colors" />
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><path d="M6 3h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M12 9v12"></path><path d="M8 21h8"></path><path d="M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7"></path></svg>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Caregiver Data Access Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 p-8 md:p-10"
        >
          <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Caregiver Data Access</h2>
              <p className="text-gray-500 font-medium mt-1 text-[13px]">Manage what information your care team can see.</p>
            </div>
            <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {caregivers.length} Active
            </div>
          </div>

          <div className="space-y-6">
            {caregivers.map(caregiver => (
              <div key={caregiver.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                    <Image src={caregiver.image} alt={caregiver.name} fill className="object-cover object-top" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[15px]">{caregiver.name}</h3>
                    <p className="text-xs font-bold text-gray-400 mt-0.5">{caregiver.role}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                   {(['Diary', 'Alerts', 'Vault'] as CaregiverPermission[]).map(perm => {
                     const isGranted = caregiver.permissions.includes(perm);
                     return (
                       <button 
                         key={perm}
                         onClick={() => togglePermission(caregiver.id, perm)}
                         className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all w-[72px] ${
                           isGranted 
                             ? 'bg-white border-emerald-200 shadow-sm' 
                             : 'bg-transparent border-gray-200 opacity-60 hover:opacity-100 hover:bg-white hover:border-gray-300'
                         }`}
                       >
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                           isGranted ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-400'
                         }`}>
                            {perm === 'Diary' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>}
                            {perm === 'Alerts' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
                            {perm === 'Vault' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>}
                         </div>
                         <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${isGranted ? 'text-gray-900' : 'text-gray-500'}`}>{perm}</span>
                         <div className={`w-full h-1 rounded-full mt-1 ${isGranted ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                       </button>
                     );
                   })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
