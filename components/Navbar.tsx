import { NavbarProps } from '@/content/types';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar({ links }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <Image src="/images/mimamori_logo1.png" alt="Mimamori Logo" width={40} height={40} className="object-contain" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">Mimamori</span>
          </div>
          
          <div className="flex-1 hidden md:flex justify-center items-center space-x-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-brand transition-colors"
            >
              Log In
            </Link>
            <Link 
              href="/signup"
              className="bg-brand text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
