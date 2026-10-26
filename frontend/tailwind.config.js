/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF', // Light indigo
          100: '#E0E7FF',
          200: '#C7D2FE', // Indigo border
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5', // Primary indigo
          700: '#4338CA',
          800: '#3730A3', // Dark indigo
          900: '#312E81',
          950: '#1E1B4B',
        },
        indigoStudio: {
          primary: '#4F46E5',
          dark: '#3730A3',
          light: '#EEF2FF',
          border: '#C7D2FE',
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          textMain: '#111827',
          textSecondary: '#64748B',
          borderDefault: '#E2E8F0',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
        },
        dark: {
          950: '#060d17',
          900: '#0b1329',
          800: '#111e38',
          700: '#1b2d52',
        }
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        heavy: '24px',
      },
      boxShadow: {
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)',
        'glass-md': '0 8px 32px 0 rgba(0, 0, 0, 0.18), inset 0 1px 1px 0 rgba(255, 255, 255, 0.25)',
        'glass-glow': '0 0 25px -5px rgba(79, 70, 229, 0.35), 0 8px 32px 0 rgba(0, 0, 0, 0.08)',
        'glass-indigo': '0 0 25px -5px rgba(79, 70, 229, 0.35)',
      },
      borderRadius: {
        'glass': '1.25rem',
        'glass-lg': '1.5rem',
      },
      animation: {
        'blob': 'blob 10s infinite alternate cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(40px, -60px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
