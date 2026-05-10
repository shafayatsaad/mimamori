/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          DEFAULT: '#00D166',
          green: '#00D166',
          dark: 'var(--color-brand-dark)',
          blue: 'var(--color-brand-blue)',
          teal: 'var(--color-brand-teal)',
        }
      },
      backgroundImage: {
        'dot-grid': "radial-gradient(#e5e7eb 1px, transparent 1px)",
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      }
    },
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
};
