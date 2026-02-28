'use client';
import { FamilyFeature } from '../content/types';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface FamilyFeaturesSectionProps {
  sectionTitle: string;
  sectionSubtitle?: string;
  features: FamilyFeature[];
}

export default function FamilyFeaturesSection({
  sectionTitle,
  features
}: FamilyFeaturesSectionProps) {
  const titleParts = sectionTitle.split('Built for care');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section id="families" className="py-24 px-4 bg-gray-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        {/* Left side: Image */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full md:w-1/2 relative aspect-[4/5] md:aspect-square rounded-[2.5rem] overflow-hidden drop-shadow-2xl"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <Image
              src="/images/family-care-photo-hd.png"
              alt="Healthcare professional caring for an elderly patient"
              fill
              className="object-cover scale-110"
            />
          </motion.div>
          {/* Exact glassy badge matching image */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="absolute bottom-10 left-10 bg-white/30 backdrop-blur-md px-5 py-3 rounded-[2rem] flex items-center gap-3 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shadow-lg"
            >
              {/* solid green circle with black heart */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </motion.div>
            <div>
              <div className="text-[15px] font-bold text-gray-900 leading-tight">Peace of Mind</div>
              <div className="text-[11px] font-medium text-gray-700">Guaranteed 24/7</div>
            </div>
          </motion.div>
        </motion.div>
        
        {/* Right side: Features */}
        <div className="w-full md:w-1/2">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight"
          >
            {titleParts[0]}
            <br className="hidden md:block" />
            <span className="text-brand">Built for care.</span>
          </motion.h2>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="space-y-10 mt-12"
          >
            {features.map((feature) => (
              <motion.div variants={itemVariants} key={feature.id} className="flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-[10px] bg-gray-100/80 flex items-center justify-center text-gray-800 border border-gray-200/50">
                  {/* Map correct SVG icons based on feature icon name */}
                  {feature.icon === 'bell' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  )}
                  {feature.icon === 'chart' && (
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  )}
                  {feature.icon === 'users' && (
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1.5">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm pr-4">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}



