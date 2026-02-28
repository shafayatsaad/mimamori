'use client';
import { Feature } from '../content/types';
import { motion } from 'framer-motion';

interface FeatureExplanationSectionProps {
  sectionTitle: string;
  sectionSubtitle?: string;
  features: Feature[];
}

export default function FeatureExplanationSection({ 
  sectionTitle, 
  sectionSubtitle,
  features 
}: FeatureExplanationSectionProps) {
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section id="features" className="py-24 px-4 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-3xl md:text-5xl font-bold text-gray-900 mb-6"
        >
          {sectionTitle}
        </motion.h2>
        
        {sectionSubtitle && (
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-gray-500 max-w-2xl mx-auto mb-16 text-lg"
          >
            {sectionSubtitle}
          </motion.p>
        )}
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {features.map((feature) => (
            <motion.div 
              key={feature.id} 
              variants={cardVariants}
              whileHover={{ y: -10, transition: { duration: 0.3 } }}
              className="p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:border-brand/30 transition-all bg-white text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-10 overflow-hidden">
                {feature.icon === 'microphone' && (
                  <div className="bg-brand/10 text-brand w-full h-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                  </div>
                )}
                {feature.icon === 'brain' && (
                  <div className="bg-blue-50 text-blue-500 w-full h-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                  </div>
                )}
                {feature.icon === 'document' && (
                  <div className="bg-purple-50 text-purple-500 w-full h-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm mb-8 flex-grow">{feature.description}</p>
              
              {/* Bottom Visual Element aligned with design */}
              <div className="mt-auto h-24 bg-gray-50/50 rounded-2xl border border-gray-100/60 overflow-hidden flex items-center justify-center p-4">
                {feature.icon === 'microphone' && (
                  <div className="flex gap-1 items-center h-10">
                    <motion.div animate={{ height: [10, 25, 10] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1 bg-brand rounded-full"></motion.div>
                    <motion.div animate={{ height: [15, 35, 15] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 bg-brand rounded-full"></motion.div>
                    <motion.div animate={{ height: [20, 40, 20] }} transition={{ repeat: Infinity, duration: 1.1, delay: 0.4 }} className="w-1 bg-brand rounded-full"></motion.div>
                    <motion.div animate={{ height: [15, 30, 15] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.1 }} className="w-1 bg-brand rounded-full"></motion.div>
                    <motion.div animate={{ height: [10, 28, 10] }} transition={{ repeat: Infinity, duration: 1.3, delay: 0.3 }} className="w-1 bg-brand rounded-full"></motion.div>
                  </div>
                )}
                {feature.icon === 'brain' && (
                  <div className="w-full flex items-center gap-2">
                    <div className="h-2 flex-grow bg-gray-200 rounded-full relative overflow-hidden">
                       <motion.div 
                         initial={{ width: "0%" }}
                         whileInView={{ width: "100%" }}
                         transition={{ duration: 2, ease: "easeInOut" }}
                         className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                       />
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Processing...</div>
                  </div>
                )}
                {feature.icon === 'document' && (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-10 h-12 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col p-2 gap-1 relative"
                  >
                    <div className="w-4 h-0.5 bg-gray-200 rounded-full"></div>
                    <div className="w-full h-0.5 bg-gray-200 rounded-full"></div>
                    <div className="w-full h-0.5 bg-gray-200 rounded-full"></div>
                    <div className="w-2/3 h-0.5 bg-gray-200 rounded-full"></div>
                    <div className="absolute right-1 bottom-1 text-[6px] text-purple-500 font-bold">PDF</div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


