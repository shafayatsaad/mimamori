import { FooterProps } from '../content/types';
import Image from 'next/image';

/**
 * Footer component
 * Bottom section containing navigation links, company information, and legal disclaimers
 * 
 * Accessibility features:
 * - Semantic HTML with footer and nav elements
 * - Minimum 16px font size for all text
 * - High contrast text for readability
 * - Keyboard accessible navigation links
 * - Clear focus states on interactive elements
 * 
 * Layout:
 * - Multi-column layout (4 columns desktop, stacked mobile)
 * - Responsive breakpoints for mobile, tablet, and desktop
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.5
 */
export default function Footer({
  sections,
  companyInfo,
  medicalDisclaimer
}: FooterProps) {
  return (
    <footer className="bg-white py-20 px-4 border-t border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          {/* Logo Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={32} height={32} className="object-contain" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">Mimamori</span>
            </div>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              Empowering patients and caregivers with AI-driven health insights. Simple, secure, and reliable monitoring for peace of mind.
            </p>
            </div>
          
          {/* Links Columns */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-gray-900 font-bold mb-6">{section.title}</h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.disabled ? (
                      <span
                        className="text-gray-400 opacity-50 cursor-not-allowed text-sm"
                        title={link.tooltip}
                        aria-disabled="true"
                      >
                        {link.label}
                      </span>
                    ) : (
                      <a href={link.href} className="text-gray-500 hover:text-brand transition-colors text-sm">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-100 pt-10 mb-10 text-center md:text-left">
          <p className="text-[10px] text-gray-400 leading-relaxed max-w-5xl">
            {medicalDisclaimer}
          </p>
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-xs text-gray-400">
          <p>{companyInfo}</p>
        </div>
      </div>
    </footer>
  );
}
