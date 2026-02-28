'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

export interface HeroSectionProps {
  badge: string;
  tagline: string;
  subtitle: string;
  designImageUrl: string;
  designImageAlt: string;
}

export default function HeroSection({ 
  badge,
  tagline, 
  subtitle,
  designImageUrl, 
  designImageAlt 
}: HeroSectionProps) {
  // Split title to highlight "health"
  const titleParts = tagline.split('health');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8 } 
    }
  };

  return (
    <section className="relative pt-32 pb-24 px-4 bg-dots overflow-hidden">
      {/* Subtle green gradient background from top right */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-0 right-0 w-1/2 h-[500px] bg-brand/10 blur-[130px] rounded-bl-full pointer-events-none -z-10" 
      />
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side: Content */}
        <motion.div 
          className="flex flex-col items-start text-left"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wider text-brand bg-brand/10 mb-6">
            <span className="mr-1 text-[10px]">●</span> {badge}
          </motion.div>
          
          {/* Heading */}
          <motion.h1 variants={itemVariants} className="text-5xl md:text-6xl lg:text-[64px] font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
            {titleParts[0]}
            <span className="text-brand relative inline-block">
              health
              {/* Subtle underline animation */}
              <motion.span 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.8, ease: "circOut" }}
                className="absolute -bottom-2 left-0 w-full h-2 bg-brand/20 -z-10 rounded-full origin-left"
              />
            </span>
            {titleParts[1]}
          </motion.h1>
          
          {/* Subtitle */}
          <motion.p variants={itemVariants} className="text-gray-500 text-lg mb-10 leading-relaxed max-w-lg">
            {subtitle}
          </motion.p>
          
          {/* Email Form */}
          <motion.div variants={itemVariants} className="w-full max-w-md mb-6">
            <Link 
              href="/signup"
              className="bg-brand-dark text-white px-8 py-4 rounded-xl font-bold hover:bg-brand-dark/90 transition-all shadow-lg hover:shadow-xl whitespace-nowrap active:scale-95 flex items-center justify-center"
            >
              Start for Free
            </Link>
          </motion.div>
        </motion.div>
        
        {/* Right Side: Hero Image / Dashboard Mockup with floating animation */}
        <motion.div 
          initial={{ opacity: 0, x: 50, rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }}
          className="relative w-full aspect-[4/3] rounded-[2rem] overflow-hidden drop-shadow-2xl"
        >
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full relative"
          >
           <Image
              src={designImageUrl}
              alt={designImageAlt}
              fill
              className="object-contain"
              priority
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

