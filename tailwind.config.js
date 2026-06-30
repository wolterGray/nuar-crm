/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/**/*.css',
    './index.html',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      colors: {
        background: '#0B0D10',
        surface: '#111418',
        surfaceAlt: '#151922',
        border: 'rgba(255,255,255,0.08)',
        textPrimary: '#F5F7FA',
        textSecondary: '#A1A8B3',
        textMuted: '#6B7280',
        accentSuccess: '#10B981',
        accentWarning: '#F59E0B',
        accentError: '#EF4444',
        accentInfo: '#3B82F6',
        brandAccent: '#D1BFA7',
      },
      borderRadius: {
        card: '16px',
        input: '12px',
        button: '12px',
        modal: '20px',
      },
      boxShadow: {
        layer: '0 8px 32px rgba(0,0,0,0.25)',
      },
      transitionDuration: {
        DEFAULT: '150',
      },
      scale: {
        98: '0.98',
      },
    },
  },
  plugins: [],
};
